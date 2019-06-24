require('dotenv').config()
const Canvas = require('@kth/canvas-api')
const canvas = Canvas(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)

async function main () {
  for await (const user of canvas.list(`/accounts/1/users?per_page=100`)) {
    console.log(user)
  }
}
main()
