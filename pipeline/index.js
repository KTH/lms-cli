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

async function getVersion(url) {
  const html = await rp({
    method: 'GET',
    followRedirect: false,
    url
  })

  const line = html
    .split('\n')
    .filter(line => line.indexOf('version.dockerVersion:') !== -1)[0]

  return line.split(':')[1]
}

async function start () {
  const builds = await getBuilds('lms-export-results')
  const active = await getVersion('https://api.kth.se/api/lms-export-results/_about')
  const stage = await getVersion('https://api-r.referens.sys.kth.se/api/lms-export-results/_about')

  const info = builds.map(b => {
    const short = b.commit.slice(0, 7)

    return {
      id: b.id,
      commit: short,
      branch: b.branch,
      active: active.indexOf(b.id + '_' + short) !== -1,
      stage: stage.indexOf(b.id + '_' + short) !== -1
    }
  })

  console.log(info.map(i =>
    `${i.id}: ${i.active ? '[ ACTIVE ]' : ''} ${i.stage ? '[ STAGE ]' : ''}`
  ).join('\n'))
}

start()
