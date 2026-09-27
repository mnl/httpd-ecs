// Load test for httpd-ecs.
//
// One script, two uses (see .github/workflows/loadtest.yml):
//   PR gate      short run at modest rps, fails on errors, timeouts and
//                egregious latency
//   Nightly soak same script with a long duration; the workflow samples
//                container memory around it to catch slow leaks
//
// Everything is an environment variable so the gate and the soak cannot drift
// apart:
//
//   BASE_URL        target base URL                     (http://localhost:8080)
//   DURATION        test duration                        (90s)
//   RPS             requests/s against /                 (50)
//   NOT_FOUND_RPS   requests/s against missing paths,    (5)
//                   to keep the error log pipeline busy; 0 disables
//   MAX_VUS         concurrency ceiling                  (50)
//   REQ_TIMEOUT     per-request timeout                  (10s)
//   MAX_ERROR_RATE  tolerated ratio of failed requests   (0.01)
//   MAX_P95_MS      p95 latency budget, milliseconds     (200)
//   MAX_P99_MS      p99 latency budget, milliseconds     (500)
//   SUMMARY_JSON    also write the raw summary here      (off)
//
// Locally, against a container published on 8030 (see `make loadtest`):
//   k6 run -e BASE_URL=http://localhost:8030 loadtest/load.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

function env(name, fallback) {
	const v = __ENV[name];
	return v === undefined || v === '' ? fallback : v;
}

function num(name, fallback) {
	const v = Number(env(name, fallback));
	if (!Number.isFinite(v)) {
		throw new Error(`${name} must be a number, got "${__ENV[name]}"`);
	}
	return v;
}

const BASE_URL = env('BASE_URL', 'http://localhost:8080').replace(/\/+$/, '');
const DURATION = env('DURATION', '90s');
const RPS = num('RPS', 50);
const NOT_FOUND_RPS = num('NOT_FOUND_RPS', 5);
const MAX_VUS = num('MAX_VUS', 50);
const REQ_TIMEOUT = env('REQ_TIMEOUT', '10s');
const MAX_ERROR_RATE = num('MAX_ERROR_RATE', 0.01);
const MAX_P95_MS = num('MAX_P95_MS', 200);
const MAX_P99_MS = num('MAX_P99_MS', 500);
const SUMMARY_JSON = env('SUMMARY_JSON', '');

// Quotes and backslashes go through alog2ecs' json escaping, like the smoke test.
const USER_AGENT = 'k6-httpd-ecs escape \\"this\\"';

// A request that never got an answer counts as failed either way, but the
// reason matters: timeouts mean httpd stopped keeping up, so count them apart
// and tolerate none.
const timeouts = new Counter('httpd_timeouts');
const ERR_TIMEOUT = 1050; // k6 error_code for "request timeout"

// Constant arrival rate, not constant VUs: we want to offer a fixed load and
// watch latency, instead of slowing the client down together with the server.
function arrivals(exec, rate) {
	return {
		executor: 'constant-arrival-rate',
		exec: exec,
		rate: rate,
		timeUnit: '1s',
		duration: DURATION,
		preAllocatedVUs: Math.min(MAX_VUS, Math.max(2, Math.ceil(rate / 10))),
		maxVUs: MAX_VUS,
		gracefulStop: '5s',
		tags: { target: exec },
	};
}

const scenarios = { index: arrivals('index', RPS) };
if (NOT_FOUND_RPS > 0) {
	scenarios.missing = arrivals('missing', NOT_FOUND_RPS);
}

export const options = {
	scenarios: scenarios,
	thresholds: {
		// Fail fast: a build that 500s or refuses connections should not burn
		// the full duration before the job goes red.
		http_req_failed: [
			{
				threshold: `rate<${MAX_ERROR_RATE}`,
				abortOnFail: true,
				delayAbortEval: '15s',
			},
		],
		httpd_timeouts: ['count<1'],
		// Dropped iterations mean k6 could not even offer the configured load,
		// i.e. responses got slow enough to exhaust the VU pool.
		dropped_iterations: ['count<1'],
		checks: ['rate>0.99'],
		// Tripwires for egregious latency, not performance targets: serving a
		// static file over loopback is a low single-digit number of ms.
		'http_req_duration{target:index}': [
			`p(95)<${MAX_P95_MS}`,
			`p(99)<${MAX_P99_MS}`,
		],
	},
	summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const indexParams = {
	timeout: REQ_TIMEOUT,
	headers: { 'User-Agent': USER_AGENT },
};

const missingParams = {
	timeout: REQ_TIMEOUT,
	headers: { 'User-Agent': USER_AGENT },
	// 404 is the expected answer here, so don't let it count as a failure.
	responseCallback: http.expectedStatuses(404),
};

function countTimeout(res) {
	if (res.error_code === ERR_TIMEOUT) {
		timeouts.add(1);
	}
}

export function index() {
	const res = http.get(`${BASE_URL}/`, indexParams);
	countTimeout(res);
	check(res, {
		'index: 200': (r) => r.status === 200,
		'index: body served': (r) => r.body !== null && r.body.length > 0,
		'index: html content type': (r) =>
			(r.headers['Content-Type'] || '').indexOf('text/html') === 0,
		'index: nosniff': (r) => r.headers['X-Content-Type-Options'] === 'nosniff',
		'index: frame options': (r) => r.headers['X-Frame-Options'] === 'SAMEORIGIN',
	});
}

// Misses exercise the other half of the logging setup: every one of these
// writes an error log line through elog2ecs.
export function missing() {
	const res = http.get(`${BASE_URL}/missing/${__VU}-${__ITER}`, missingParams);
	countTimeout(res);
	check(res, { 'missing: 404': (r) => r.status === 404 });
}

// Own summary instead of k6's: the numbers this gate cares about, in a shape
// that survives being read in CI logs. The raw data goes to SUMMARY_JSON.
export function handleSummary(data) {
	const out = { stdout: report(data) };
	if (SUMMARY_JSON) {
		out[SUMMARY_JSON] = JSON.stringify(data, null, 2);
	}
	return out;
}

function values(data, name) {
	const m = data.metrics && data.metrics[name];
	return (m && m.values) || {};
}

function ms(v) {
	return v === undefined ? 'n/a' : `${v.toFixed(2)}ms`;
}

function pct(v) {
	return v === undefined ? 'n/a' : `${(v * 100).toFixed(2)}%`;
}

function list(x) {
	return Array.isArray(x) ? x : Object.values(x || {});
}

function failedChecks(group, acc) {
	for (const c of list(group && group.checks)) {
		if (c.fails > 0) {
			acc.push(`${c.name}: ${c.fails} of ${c.fails + c.passes} failed`);
		}
	}
	for (const g of list(group && group.groups)) {
		failedChecks(g, acc);
	}
	return acc;
}

function report(data) {
	const reqs = values(data, 'http_reqs');
	const failed = values(data, 'http_req_failed');
	const latency = values(data, 'http_req_duration{target:index}');

	const lines = [
		'',
		`httpd-ecs load test: ${BASE_URL} for ${DURATION}, ${RPS} rps` +
			(NOT_FOUND_RPS > 0 ? ` plus ${NOT_FOUND_RPS} rps of misses` : ''),
		'',
		`  requests       ${reqs.count || 0} total, ${(reqs.rate || 0).toFixed(1)}/s achieved`,
		`  failed         ${pct(failed.rate)} of ${failed.passes + failed.fails || 0} (budget ${pct(MAX_ERROR_RATE)})`,
		`  timeouts       ${values(data, 'httpd_timeouts').count || 0}`,
		`  dropped iters  ${values(data, 'dropped_iterations').count || 0}`,
		`  checks         ${pct(values(data, 'checks').rate)}`,
		`  latency of /   avg ${ms(latency.avg)}  med ${ms(latency.med)}  p95 ${ms(latency['p(95)'])}  p99 ${ms(latency['p(99)'])}  max ${ms(latency.max)}`,
		'',
		'  thresholds',
	];

	for (const [name, metric] of Object.entries(data.metrics || {})) {
		for (const [expr, result] of Object.entries((metric && metric.thresholds) || {})) {
			lines.push(`    ${result.ok ? 'pass' : 'FAIL'}  ${name} ${expr}`);
		}
	}

	const bad = failedChecks(data.root_group, []);
	if (bad.length > 0) {
		lines.push('', '  failed checks');
		for (const c of bad) {
			lines.push(`    ${c}`);
		}
	}

	lines.push('');
	return lines.join('\n');
}
