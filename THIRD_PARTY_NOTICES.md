# Third-party notices

Geo routing can download two v2fly datasets. They are not committed. `npm run geo:fetch` checks each official `.sha256sum` asset, checks the bytes, and only then writes `data/geo/`. Other publishers are not used.

## geoip.dat

- Project: [v2fly/geoip](https://github.com/v2fly/geoip)
- Release tag: `202611080027`
- Asset: `geoip.dat`
- SHA-256: `eedb24b3b9fcba27e06b92c0428dab90d9496083091ae4cf39e11387fd99d0e2`
- Project license: [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- The free IP geolocation data by [DB-IP](https://db-ip.com) is licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

The file is redistributed unchanged. Attribution: v2fly geoip contributors, release `202611080027`.

## geosite.dat

- Project: [v2fly/domain-list-community](https://github.com/v2fly/domain-list-community)
- Release tag: `20261108011013`
- Upstream asset: `dlc.dat`, saved as `geosite.dat`
- SHA-256: `dc4192dd1b644a38276ed06136d26e729fa674d25785adb38c87e040e92376b2`
- License: MIT

```
MIT License

Copyright (c) 2018-2019 V2Ray

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
