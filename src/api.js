const fetch = require('node-fetch')
const { URLSearchParams } = require('url')
const inquirer = require('inquirer')
const { notify } = require('./notify')

const api = 'https://api.pushover.net/1'

const routes = {
  register: `${api}/devices.json`,
  login: `${api}/users/login.json`,
  messages: `${api}/messages.json`,
  read: deviceId => `${api}/devices/${deviceId}/update_highest_message.json`,
}

function getMessages(secret, deviceId) {
  return fetch(
    `${routes.messages}?secret=${secret}&device_id=${deviceId}`,
  ).then(response => response.json())
}

function markAsRead(secret, deviceId, messageID) {
  const body = new URLSearchParams()
  body.append('secret', secret)
  body.append('message', messageID)

  return fetch(routes.read(deviceId), {
    method: 'POST',
    body,
  }).then(response => response.json())
}

async function login(email, password, secondFactor) {
  const body = new URLSearchParams()
  body.append('email', email)
  body.append('password', password)
  if (secondFactor) {
    body.append('twofa', secondFactor)
  }

  const response = await fetch(routes.login, {
    method: 'POST',
    body,
  })

  if (response.ok) {
    return response.json()
  }

  if (response.code === 412) {
    const { twofa } = await inquirer.prompt([
      { name: 'twofa', message: 'Please enter your second factor auth code' },
    ])
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
    const { name } = await inquirer.prompt([
      { name: 'name', message: 'Please provide a name for this client' },
    ])
    if (!name) {
      console.error('Invalid or missing name')
      process.exit(1)
    }

    return registerDevice(secret, name)
  }

  return response
}

async function readAllMessages(secret, deviceId) {
  const { messages } = await getMessages(secret, deviceId)

  if (messages && messages.length > 0) {
    messages.forEach(msg => notify(msg.title, msg.message))
    const lastMessage = messages[messages.length - 1]
    await markAsRead(secret, deviceId, lastMessage.id)
  }
}

module.exports = {
  readAllMessages,
  registerDevice,
  login,
  getMessages,
  markAsRead,
}
