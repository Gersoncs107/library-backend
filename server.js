const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/use/ws')

const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')

const {
  ApolloServerPluginDrainHttpServer,
} = require('@apollo/server/plugin/drainHttpServer')
const { expressMiddleware } = require('@as-integrations/express5')
const cors = require('cors')
const express = require('express')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const http = require('http')

const jwt = require('jsonwebtoken')

const resolvers = require('./resolvers')
const typeDefs = require('./schema')
const User = require('./models/User')

const getUserFromAuthHeader = async (auth) => {
  if (!auth || !auth.startsWith('Bearer ')) {
    return null
  }
  try {
    const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
    return User.findById(decodedToken.id)
  } catch {
    return null
  }
}

const startServer = async (port) => {
  const app = express()
  const httpServer = http.createServer(app)

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/',
  })

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const serverCleanup = useServer({ schema }, wsServer)

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose()
            },
          }
        },
      },
    ],
  })

  await server.start()

  app.use(
    '/',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = req.headers.authorization
        const currentUser = await getUserFromAuthHeader(auth)
        return { currentUser }
      },
    }),
  )

  await new Promise((resolve, reject) => {
    const tryListen = (candidatePort) => {
      const onError = (error) => {
        if (error.code === 'EADDRINUSE' && candidatePort !== 0) {
          console.warn(`Port ${candidatePort} is busy, trying an available port...`)
          httpServer.removeListener('error', onError)
          tryListen(0)
          return
        }
        reject(error)
      }

      httpServer.once('error', onError)
      httpServer.listen(candidatePort, () => {
        httpServer.removeListener('error', onError)
        resolve()
      })
    }

    tryListen(port)
  })

  const address = httpServer.address()
  console.log(`Server is now running on http://localhost:${address.port}`)
  return address.port
}

module.exports = startServer