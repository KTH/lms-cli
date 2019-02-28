require('dotenv').config()
const inquirer = require('inquirer')
const rp = require('request-promise')

async function getBuilds (app) {
  const auth = `Basic ${Buffer.from(process.env.BUILD_USERNAME + ':' + process.env.BUILD_TOKEN).toString('base64')}`

  const { builds } = await rp({
    url: `https://build.sys.kth.se/job/${app}/api/json?tree=builds[number,url]`,
    method: 'GET',
    json: true,
    headers: {
      'Authorization': auth
    }
  })

  const buildsStatus = await Promise.all(builds.map(({ url }) => rp({
    url: `${url}/api/json?`,
    method: 'GET',
    json: true,
    headers: {
      'Authorization': auth
    }
  })))

  return buildsStatus
    .map(({ id, result, actions }) => ({
      id,
      result,
      actions: actions
        .filter(a => a._class && a._class.includes('git'))
        .map(a => a.lastBuiltRevision || (a.build && a.build.revision))
        .filter(a => a)
    }))
    .map(({ id, result, actions }) => ({
      id,
      result,
      commit: actions[0].SHA1,
      branch: actions[0].branch[0].name
    }))
}


async function start () {
  const builds = await getBuilds('lms-export-results')


  console.log(builds)
  console.log(builds.length)
}

start()
