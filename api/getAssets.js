const fetch = require("node-fetch");
const { config } = require("../lib/config");
const apiUrlAssets = require("./apiUrlAssets");

module.exports = () =>
  new Promise((resolve, reject) => {
    fetch(apiUrlAssets, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": config.appPassword,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    })
      .then(r => {
        if (r.status == 404) {
          let err orText = r.statusText;
          return reject(`[ERROR] ${errorText}`);
        }
        return r.json();
      })
      .then(r => {
        return resolve(r.assets);
      })
      .catch(reject);
  });
