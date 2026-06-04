const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const jwt = require('jsonwebtoken')

const resolvers = require('./resolvers')
const typeDefs = require('./schema')
const User = require('./models/User')

const getUserFromAuthHeader = async (auth) => {
  if (!auth || !auth.startsWith('Bearer ')) {
    return null
  }
 
  const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
  return User.findById(decodedToken.id).populate('friends')
}

const startServer = (port) => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      const auth = req.headers.authorization || ''
      const user = await getUserFromAuthHeader(auth)
      return { user }
    }
  })

  startStandaloneServer(server, {
    listen: { port },
  }).then(({ url }) => {
    console.log(`Server ready at ${url}`)
  })
}

module.exports = startServer