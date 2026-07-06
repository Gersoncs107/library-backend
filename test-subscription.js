const { createClient } = require('graphql-ws')
const ws = require('ws')
const fetch = require('node-fetch') // se Node < 18; em Node 18+ fetch já é global

const HTTP_URL = 'http://localhost:4000'
const WS_URL = 'ws://localhost:4000'

// ---- Configurações: ajuste aqui ----
const USERNAME = 'gerson'
const PASSWORD = 'secret'
// -------------------------------------

async function graphqlRequest(query, variables = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(HTTP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()
  if (result.errors) {
    console.error('Erro GraphQL:', JSON.stringify(result.errors, null, 2))
    throw new Error('GraphQL request failed')
  }
  return result.data
}

async function login() {
  const data = await graphqlRequest(
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        value
      }
    }`,
    { username: USERNAME, password: PASSWORD }
  )
  return data.login.value
}

async function addPerson(token, person) {
  return graphqlRequest(
    `mutation AddPerson($name: String!, $phone: String, $street: String!, $city: String!) {
      addPerson(name: $name, phone: $phone, street: $street, city: $city) {
        id
        name
        phone
      }
    }`,
    person,
    token
  )
}

async function main() {
  // 1. Conecta na subscription
  const client = createClient({ url: WS_URL, webSocketImpl: ws })

  client.subscribe(
    { query: 'subscription { personAdded { name phone } }' },
    {
      next: (data) => console.log('📨 Evento recebido:', JSON.stringify(data, null, 2)),
      error: (err) => console.error('❌ Erro na subscription:', err),
      complete: () => console.log('✅ Subscription completa'),
    }
  )

  console.log('👂 Escutando subscriptions...\n')

  // 2. Espera um pouco para garantir que a subscription já conectou
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // 3. Faz login
  console.log('🔑 Fazendo login...')
  const token = await login()
  console.log('✅ Token obtido\n')

  // 4. Dispara a mutation addPerson
  console.log('➕ Criando person...')
  const result = await addPerson(token, {
    name: 'Maria Silva',
    phone: '040-1234567',
    street: 'Rua das Flores',
    city: 'Recife',
  })
  console.log('✅ Person criada:', result.addPerson)

  console.log('\n⏳ Mantendo conexão aberta por 5s para garantir o recebimento do evento...')
  await new Promise((resolve) => setTimeout(resolve, 5000))
  process.exit(0)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})