const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const crawlerDir = path.resolve(__dirname, '../../backend/src/modules/crawler');
const crawlerRequire = createRequire(path.join(crawlerDir, 'crawler.js'));

for (const filename of fs.readdirSync(crawlerDir).filter(name => name.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(crawlerDir, filename), 'utf8'), { filename });
}

assert.equal(typeof crawlerRequire('playwright').chromium.launch, 'function');
assert.equal(typeof crawlerRequire('./crawler').startCrawler, 'function');
assert.equal(typeof crawlerRequire('./extractor').extractPlaceDetails, 'function');

for (const moduleName of ['dotenv', 'pg']) crawlerRequire(moduleName);

let crawlOptions;
vm.runInNewContext(fs.readFileSync(path.join(crawlerDir, 'google-maps-crawler.js'), 'utf8'), {
  process: { argv: ['node', 'google-maps-crawler.js', 'hcm', '1000', '--append', '--headless'] },
  require(moduleName) {
    assert.equal(moduleName, './crawler');
    return { startCrawler(options) { crawlOptions = options; } };
  },
});
assert.equal(crawlOptions.province, 'HCMC');
assert.equal(crawlOptions.targetTotal, 1000);
assert.equal(crawlOptions.append, true);
assert.equal(crawlOptions.headless, true);

for (const relativePath of ['../../../.env.example', '../../../docker/postgres/init.sql', '../../../prisma/migrations', '../../../prisma/seed.sql']) {
  assert.ok(fs.existsSync(path.resolve(crawlerDir, relativePath)), relativePath);
}

const stagedPath = path.join(crawlerDir, 'data/staged-google-places.json');
const staged = fs.existsSync(stagedPath) ? JSON.parse(fs.readFileSync(stagedPath, 'utf8')) : [];
assert.ok(Array.isArray(staged));
const previewHtml = fs.readFileSync(path.join(crawlerDir, 'preview-places.html'), 'utf8');
assert.ok(previewHtml.includes('./data/staged-google-places.js'));
assert.ok(previewHtml.includes('./data/staged-google-places.json'));

// Exercise relocated storage in isolation so the real crawl data stays intact.
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tripgenie-crawler-'));
try {
  const sandbox = {
    require: crawlerRequire,
    __dirname: temporaryDir,
    module: { exports: {} },
    console: { log() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(crawlerDir, 'storage.js'), 'utf8'), sandbox);
  const { savePlaces } = sandbox.module.exports;
  const firstPlace = { name: 'Crawler storage check A' };
  const secondPlace = { name: 'Crawler storage check B' };
  const initial = savePlaces([firstPlace]);
  assert.equal(initial.jsonFile, path.join(temporaryDir, 'data/staged-google-places.json'));
  const appended = savePlaces([firstPlace, secondPlace], true);
  assert.deepEqual(JSON.parse(fs.readFileSync(appended.jsonFile, 'utf8')), [firstPlace, secondPlace]);
  assert.equal(fs.readdirSync(path.join(temporaryDir, 'data/history')).length, 1);
  const browserData = {};
  vm.runInNewContext(fs.readFileSync(appended.jsFile, 'utf8'), { window: browserData });
  assert.equal(browserData.STAGED_GOOGLE_PLACES.length, 2);
} finally {
  assert.equal(fs.realpathSync(path.dirname(temporaryDir)), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(temporaryDir).startsWith('tripgenie-crawler-'));
  fs.rmSync(temporaryDir, { recursive: true, force: true });
}

console.log(`Crawler paths, dependencies, storage, append, backup and preview data passed (${staged.length} staged places).`);
