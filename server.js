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

const startServer = (port) => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  })

  startStandaloneServer(server, {
    listen: { port },
    context: async ({ req }) => {
      const auth = req.headers.authorization
      const currentUser = await getUserFromAuthHeader(auth)
      return { currentUser }
    }
  }).then(({ url }) => {
    console.log(`Server ready at ${url}`)
  })
}

module.exports = startServer