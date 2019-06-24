require('dotenv').config()
const Canvas = require('@kth/canvas-api')
const canvas = Canvas(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)

let total = 0
let hasIntegrationId = 0
async function main () {
  for await (const user of canvas.list(`/accounts/1/users?per_page=100`)) {
    if (user.integration_id) {
      hasIntegrationId++
    }
    total++

    console.log(`${hasIntegrationId} users out of ${total} checked users has integration_id set`)
  }
}
main()
