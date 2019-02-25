require('dotenv').config()
const { promisify } = require('util')
const azure = require('azure-sb')

async function start () {
  const connectionString = process.env.AZURE_SERVICEBUS_CONNECTION_STRING
  const topicName = process.env.AZURE_SERVICEBUS_TOPIC_NAME
  const subscriptionName = process.env.AZURE_SERVICEBUS_SUBSCRIPTION_NAME

  const service = azure.createServiceBusService(connectionString)
  const getSubscription = promisify(service.getSubscription.bind(service))

  const r = await getSubscription(topicName, subscriptionName)

  console.log(`Messages in normal queue: ${r.CountDetails['d3p1:ActiveMessageCount']}`)
  console.log(`Messages in DLQ:          ${r.CountDetails['d3p1:DeadLetterMessageCount']}`)
}

start()
