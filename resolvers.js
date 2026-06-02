const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const User = require('./models/user')
const Author = require('./models/author')
const Book = require('./models/book')

const handleValidationError = (error) => {
  if (error.name === 'ValidationError') {
    throw new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT' }
    })
  }
  throw new GraphQLError('Saving failed', {
    extensions: { code: 'INTERNAL_SERVER_ERROR' }
  })
}

const resolvers = {
  Query: {
    bookCount: async () => Book.countDocuments(),
    authorCount: async () => Author.countDocuments(),

    allBooks: async (root, args) => {
      let query = {}

      if (args.author) {
        const author = await Author.findOne({ name: args.author })
        if (!author) return []
        query.author = author._id
      }

      if (args.genre) {
        query.genres = { $in: [args.genre] }
      }

      return Book.find(query).populate('author')
    },

    allAuthors: async () => Author.find({}),
  },

  Author: {
    bookCount: async (root) =>
      Book.countDocuments({ author: root._id }),
  },

  Mutation: {
    addBook: async (root, args) => {
      let author = await Author.findOne({ name: args.author })

      if (!author) {
        try {
          author = await new Author({ name: args.author }).save()
        } catch (error) {
          handleValidationError(error)
        }
      }

      try {
        const book = await new Book({
          title: args.title,
          published: args.published,
          author: author._id,
          genres: args.genres,
        }).save()

        return book.populate('author')
      } catch (error) {
        handleValidationError(error)
      }
    },

    editAuthor: async (root, args) => {
      try {
        const author = await Author.findOneAndUpdate(
          { name: args.name },
          { born: args.setBornTo },
          { new: true, runValidators: true }
        )
        return author
      } catch (error) {
        handleValidationError(error)
      }
    },

    createUser: async (root, args) => {
      try {
        const user = await new User({
          username: args.username,
          favoriteGenre: args.favoriteGenre,
        }).save()
        return user
      } catch (error) {
        handleValidationError(error)
      }
    },
  },
}

module.exports = resolvers