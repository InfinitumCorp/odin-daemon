import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeGeoIpList,
  decodeGeoSiteList,
  lookupCategories,
  lookupCountry,
  matchesGeoIp,
} from "./dat.ts";
import { cidr, domain, geoIpEntry, geoIpList, geoSiteEntry, geoSiteList } from "./fixture.ts";

function sampleIp() {
  return decodeGeoIpList(
    geoIpList([
      geoIpEntry("zz", [cidr([10, 0, 0, 0], 8)]),
      geoIpEntry("aa", [cidr([10, 1, 0, 0], 16)]),
      geoIpEntry("us", [cidr([8, 8, 8, 0], 24)]),
      geoIpEntry("v6", [cidr([0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 32)]),
      geoIpEntry("inv", [cidr([10, 0, 0, 0], 8)], true),
    ]),
  );
}

test("lookupCountry maps an address to the first containing entry", () => {
  const list = sampleIp();
  assert.equal(lookupCountry(list, "10.1.2.3"), "zz");
  assert.equal(lookupCountry(list, "8.8.8.8"), "us");
  assert.equal(lookupCountry(list, "9.9.9.9"), null);
  assert.equal(lookupCountry(list, "2001:db8::1"), "v6");
  assert.equal(lookupCountry(list, "2001:db9::1"), null);
  assert.equal(lookupCountry(list, "not-an-ip"), null);
  assert.equal(lookupCountry(list, "11.0.0.1"), null);
  const inverse = list.entries.find((entry) => entry.countryCode === "inv");
  assert.ok(inverse);
  assert.equal(matchesGeoIp(inverse, "11.0.0.1"), true);
  assert.equal(matchesGeoIp(inverse, "10.1.1.1"), false);
});

test("lookupCategories matches full, domain, plain, and regex rules", () => {
  const list = decodeGeoSiteList(
    geoSiteList([
      geoSiteEntry("ads", [domain(2, "ads.example"), domain(3, "full.example")]),
      geoSiteEntry("trackers", [domain(0, "tracker"), domain(1, "^re\\.example$")]),
    ]),
  );
  assert.deepEqual(lookupCategories(list, "a.ads.example"), ["ads"]);
  assert.deepEqual(lookupCategories(list, "ads.example"), ["ads"]);
  assert.deepEqual(lookupCategories(list, "notads.example"), []);
  assert.deepEqual(lookupCategories(list, "full.example"), ["ads"]);
  assert.deepEqual(lookupCategories(list, "www.full.example"), []);
  assert.deepEqual(lookupCategories(list, "mytracker.test"), ["trackers"]);
  assert.deepEqual(lookupCategories(list, "re.example"), ["trackers"]);
  assert.deepEqual(lookupCategories(list, "https://Re.Example/path"), ["trackers"]);
});

test("a truncated geo message fails closed", () => {
  assert.throws(() => decodeGeoIpList(Uint8Array.of(0x80)), /truncated protobuf varint/);
});
