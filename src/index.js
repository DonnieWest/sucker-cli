const WebSocket = require('ws')
const arg = require('arg')
const inquirer = require('inquirer')
const { login, registerDevice, readAllMessages } = require('./api')
const { getConfiguration, saveConfiguration } = require('./config')

async function getCredentials() {
  const args = arg({
    '--email': String,
    '--password': String,

    '-e': '--email',
    '-p': '--password',
  })

  const email =
    args['--email'] ||
    (await inquirer.prompt([{ name: 'email', message: 'What is your email?' }]))
      .email
  const password =
    args['--password'] ||
    (await inquirer.prompt([
      { name: 'password', message: 'What is your password?' },
    ])).password

  if (!email) {
    console.error('Invalid or missing email')
    process.exit(1)
  }

  if (!password) {
    console.error('Invalid or missing password')
    process.exit(1)
  }

  return { email, password }
}

function listenToPushover(secret, id) {
  const ws = new WebSocket('wss://client.pushover.net/push')

  ws.on('open', function open() {
    ws.send(`login:${id}:${secret}\n`)
  })

  ws.on('message', function incoming(data) {
    switch (data.toString()) {
      case '#':
        break
      case 'R':
        break
      case '!':
        readAllMessages(secret, id)
        break
      case 'E':
        process.exit(1)
      default:
        break
    }
  })

  ws.on('close', function close() {
    console.log('Connection disconnected')
    process.exit(0)
  })
}

;(async function main() {
  let configuration = getConfiguration()
  if (!configuration || !configuration.secret) {
    const { email, password } = await getCredentials()

    const { secret } = await login(email, password)

    const { id, status } = await registerDevice(secret)

    if (status === 0 || !id) {
      console.error('Registration Failed')
      process.exit(1)
    }

    configuration = saveConfiguration({ secret, id })
  }

  listenToPushover(configuration.secret, configuration.id)
})()
