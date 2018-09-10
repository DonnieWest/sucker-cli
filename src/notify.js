const shelljs = require('shelljs')
const notifier = require('node-notifier')
const arg = require('arg')

exports.notify = function(title, message) {
  notifier.notify({
    title,
    message,
  })

  const args = arg({
    '--command': String,

    '-c': '--command',
  })

  if (args['--command']) {
    shelljs.exec(args['--command'], { async: true })
  }
}
