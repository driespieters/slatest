const fetch = require("node-fetch");
const fs = require("fs");
const md5 = require("md5");
const globby = require("globby");
const { success, error } = require("../lib/utils");
//
const generateChecksum = (filepath) => {
  // Shopify's generated checksums are md5 based on utf8 file contents
  const contents = fs.readFileSync(filepath);
  if (!contents) return null;
  return md5(contents);
};
const prepareAssets = (assetKeys) =>
  assetKeys.map((key) => {
    return {
      key,
      checksum: generateChecksum(key),
    };
  });
module.exports = (config) => () => {
  const upload = require("./upload")(config);
  globby(config.watch, {
    ignore: config.ignore,
  })
    .then((assetKeys) => {
      // Similar to deleteEntireTheme, pacing it all out simplistically
      if (!assetKeys.length) reject("No assets");
      const assetsLocal = prepareAssets(assetKeys);
      // console.log("assetsLocal", assetsLocal);
      const apiUrlAssets = require("./apiUrlAssets")(config);
      fetch(apiUrlAssets, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": config.appPassword,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })
        .catch((e) => {
          console.error(`[ERROR] uploadEntireTheme : ${e}`);
          reject(e);
        })
        .then((r) => {
          return r.json();
        })
        .then((results) => {
          const assetsOnline = results.assets;
          // console.log('assetsOnline', assetsOnline);
          // [ { key: 'assets/foo.jpg',
          // public_url:
          //  'https://cdn.shopify.com/s/files/1/0322/8468/0163/t/3/assets/foo.jpg?v=1604672009',
          // created_at: '2020-02-14T07:23:45-05:00',
          // updated_at: '2020-11-06T09:13:29-05:00',
          // content_type: 'text/css',
          // size: 49370,
          // checksum: '5712c61e7628f5a77930d0dd1e929664',
          // theme_id: 28102653439 }, ... ]
          // console.log(assetsLocal);
          //
          let assetsChanged = assetsLocal.filter((assetLocal) => {
            return !assetsOnline.find((assetOnline) => {
              return (
                assetLocal.key == assetOnline.key &&
                assetLocal.checksum == assetOnline.checksum
              );
            });
          });
          // console.log("Matches???", assetsChanged);
          console.log("Assets local", assetsLocal.length);
          console.log("Assets online", assetsOnline.length);
          console.log("Assets changed", assetsChanged.length);
          console.log(
            "(If lots get stuck as changed, consider running delete-entire-theme and trying again, as checksums were only added late 2020. That said, there may be a few malingerers regardless)"
          );
          console.log(
            `\nUploading ${
              assetsChanged.length
            } assets. This will take approximately ${Math.ceil(
              (assetsChanged.length * 500) / 500 / 60
            )} minutes..\n\nPlease note, it will not upload theme settings and data schema!\n`
          );
          const uploadAssetsPromises = assetsChanged.map(
            (a, i) =>
              new Promise((resolve) => {
                setTimeout(() => {
                  upload(a.key)
                    .then(resolve)
                    .catch((e) => {
                      e.name = a.name;
                      error(e);
                    });
                  // Shopify API call rates keep bloody changing, apparently now 4/s max
                }, i * 500);
              })
          );
          Promise.all(uploadAssetsPromises)
            .then(() => {
              success("All done!");
            })
            .catch(error);
        });
    })
    .catch(error);
};
