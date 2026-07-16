require('dotenv').config()

const { createClient } = require('graphql-ws')
const ws = require('ws')

const connectToDatabase = require('./db')
const startServer = require('./server')

const PORT = process.env.PORT || 4000
let HTTP_URL = `http://localhost:${PORT}`
let WS_URL = `ws://localhost:${PORT}`

const USERNAME = 'madruga'
const PASSWORD = 'secret'
const FAVORITE_GENRE = 'fiction'

async function graphqlRequest(query, variables = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(HTTP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()
  if (result.errors) {
    console.error('GraphQL error:', JSON.stringify(result.errors, null, 2))
    throw new Error('GraphQL request failed')
  }

  return result.data
}

async function createUser() {
  try {
    await graphqlRequest(
      `mutation CreateUser($username: String!, $favoriteGenre: String!) {
        createUser(username: $username, favoriteGenre: $favoriteGenre) {
          id
          username
          favoriteGenre
        }
      }`,
      { username: USERNAME, favoriteGenre: FAVORITE_GENRE }
    )
  } catch (error) {
    console.log('User already exists or could not be created, continuing...')
  }
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

async function addBook(token, book) {
  return graphqlRequest(
    `mutation AddBook($title: String!, $author: String!, $published: Int!, $genres: [String!]!) {
      addBook(title: $title, author: $author, published: $published, genres: $genres) {
        id
        title
        published
        author {
          name
          id
        }
        genres
      }
    }`,
    book,
    token
  )
}

async function main() {
  console.log('🔌 Connecting to MongoDB and starting the server...')
  await connectToDatabase(process.env.MONGODB_URI)
  const actualPort = await startServer(PORT)
  HTTP_URL = `http://localhost:${actualPort}`
  WS_URL = `ws://localhost:${actualPort}`

  await new Promise((resolve) => setTimeout(resolve, 1500))

  const client = createClient({
    url: WS_URL,
    webSocketImpl: ws,
  })

  const subscriptionPromise = new Promise((resolve, reject) => {
    const subscription = client.subscribe(
      {
        query: `subscription {
          bookAdded {
            id
            title
            published
            author {
              name
            }
            genres
          }
        }`,
      },
      {
        next: (data) => {
          console.log('📨 Event received:', JSON.stringify(data, null, 2))
          resolve(data)
        },
        error: (err) => reject(err),
        complete: () => console.log('✅ Subscription completed'),
      }
    )

    subscription.then?.(() => {})
  })

  console.log('👂 Listening for subscriptions...\n')

  console.log('🔑 Creating test user if necessary...')
  await createUser()

  console.log('🔑 Logging in...')
  const token = await login()
  console.log('✅ Token acquired\n')

  console.log('➕ Criando livro...')
  const result = await addBook(token, {
    title: `The Hobbit  ${Date.now()}`,
    author: 'J. R. R. Tolkien',
    published: 1954,
    genres: ['fantasy', 'adventure'],
  })

  console.log('✅ Livro criado:', result.addBook)

  console.log('\n⏳ Aguardando o evento da subscription...')
  await subscriptionPromise
  await new Promise((resolve) => setTimeout(resolve, 2000))
  process.exit(0)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})