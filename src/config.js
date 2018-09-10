const ConfigStore = require('configstore')
const pkg = require('../package.json')
const conf = new ConfigStore(pkg.name)

exports.getConfiguration = function() {
  return conf.all
}

exports.saveConfiguration = function(obj) {
  conf.set(obj)
  return conf.all
}
