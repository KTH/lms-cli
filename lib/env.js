require('dotenv').config()
const inquirer = require('inquirer')

async function getEnv (name) {
  if (!process.env[name]) {
    const { value } = await inquirer.prompt({
      name: 'value',
      message: `Set a value for "${name}"`,
      type: 'text'
    })

    process.env[name] = value
  }

  return process.env[name]
}

module.exports = {
  getEnv
}
