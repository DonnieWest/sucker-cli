const WebSocket = require('ws');
const fetch = require('node-fetch')
const { URLSearchParams } = require('url')
const notifier = require('node-notifier')
const arg = require('arg')
const inquirer = require('inquirer')
const ConfigStore = require('configstore')
const shelljs = require('shelljs')
const pkg = require('../package.json');
const conf = new ConfigStore(pkg.name)

function getConfiguration() {
  return conf.all
}

function saveConfiguration(obj) {
  conf.set(obj)
  return conf.all
}

async function getCredentials() {
  const arguments = arg({
    '--email': String,
    '--password': String,

    '-e': '--email',
    '-p': '--password',
  })

  const email = arguments['--email'] || (await inquirer.prompt([{ name: 'email', message: 'What is your email?' }])).email
  const password = arguments['--password'] || (await inquirer.prompt([{ name: 'password', message: 'What is your password?' }])).password

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

const api = 'https://api.pushover.net/1'

const routes = {
  register: `${api}/devices.json`,
  login: `${api}/users/login.json`,
  messages: `${api}/messages.json`,
  read: device_id => `${api}/devices/${device_id}/update_highest_message.json`,
}

function getMessages(secret, device_id) {
  return fetch(`${routes.messages}?secret=${secret}&device_id=${device_id}`).then(response => response.json())
}

function markAsRead(secret, device_id, messageID) {
  const body = new URLSearchParams()
  body.append('secret', secret)
  body.append('message', messageID)

  return fetch(routes.read(device_id), {
    method: 'POST',
    body
  }).then(response => response.json())
}

async function login(email, password, secondFactor) {
  const body = new URLSearchParams()
  body.append('email', email)
  body.append('password', password)
  if (secondFactor) {
    body.append('twofa', seconFactor)
  }

  const response = await fetch(routes.login, {
    method: 'POST',
    body,
  })

  if (response.ok) {
    return response.json()
  }

  if (response.code === 412) {
    const { twofa } = await inquirer.prompt([{ name: 'twofa', 'message': 'Please enter your second factor auth code' }])
    if (!twofa) {
      console.error('Second factor auth code is required to continue')
      process.exit(1)
    }
    return login(email, password, twofa)
  }

  console.error('Login failed')
  process.exit(1)

}

async function registerDevice(secret, deviceName) {
  const body = new URLSearchParams()
  body.append('secret', secret)
  body.append('name', deviceName || 'unofficial_pushover_cli')
  body.append('os', 'O')

  const response = await (await fetch(routes.register, {
    method: 'POST',
    body,
  })).json()

  if (response && response.errors && response.errors.name) {
    const { name } = await inquirer.prompt([{ name: 'name', message: 'Please provide a name for this client' }])
    if (!name) {
      console.error('Invalid or missing name')
      process.exit(1)
    }

    return registerDevice(secret, name)
  }

  return response
}


function notify(title, message) {
  notifier.notify({
    title,
    message,
  })

  const arguments = arg({
    '--command': String,

    '-c': '--command',
  })

  if (arguments['--command']) {
    shelljs.exec(arguments['--command'], { async: true })
  }

}

async function readAllMessages(secret, device_id) {
  const { messages } = await getMessages(secret, device_id)

  if (messages && messages.length > 0) {
    messages.forEach(msg => notify(msg.title, msg.message))
    const lastMessage = messages[messages.length - 1]
    await markAsRead(secret, device_id, lastMessage.id)
  }
}

function listenToPushover(secret, id) {
  const ws = new WebSocket('wss://client.pushover.net/push')

  ws.on('open', function open() {
    ws.send(`login:${id}:${secret}\n`)
  })

  ws.on('message', function incoming(data) {
    switch(data.toString()) {
      case 'E':
        process.exit(1)
        break;
      case '#':
        break
      case 'R':
        break
      case '!':
        readAllMessages(secret, id)
        break
      default:
        break
    }
  })

  ws.on('close', function close() {
    console.log('Connection disconnected')
    process.exit(0)
  })
}

(async function main() {
  let configuration = getConfiguration()
  if (!configuration || !configuration.secret) {
    const { email, password } = await getCredentials()

    const { secret } = await login(email, password)

    const { id, status, errors } = await registerDevice(secret)

    if (status === 0 || !id) {
      console.error('Registration Failed')
      process.exit(1)
    }

    configuration = saveConfiguration({ secret, id })
  }

  listenToPushover(configuration.secret, configuration.id)
})()

