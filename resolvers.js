const { GraphQLError } = require('graphql')
const { PubSub } = require('graphql-subscriptions')
const jwt = require('jsonwebtoken')

const User = require('./models/User')
const Author = require('./models/Author')
const Book = require('./models/Book')

const pubsub = new PubSub()

const requireAuth = (context) => {
  if (!context.currentUser) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' }
    })
  }
}

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

    allAuthors: async () => {
      const bookCounts = await Book.aggregate([
        { $group: { _id: '$author', count: { $sum: 1 } } }
      ])

      const authors = await Author.find({})
      return authors.map(author => {
        const bookCount = bookCounts.find(count => count._id.equals(author._id))
        return { ...author.toObject(), bookCount: bookCount ? bookCount.count : 0 }
      })
    },

    me: (root, args, context) => {
    return context.currentUser
  },
  },

  Author: {
    bookCount: async (root) =>
      Book.countDocuments({ author: root._id }),
  },

  Mutation: {
    addBook: async (root, args, context) => {
      requireAuth(context)

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

        const populatedBook = await Book.findById(book._id).populate('author')
        await pubsub.publish('BOOK_ADDED', { bookAdded: populatedBook })
        return populatedBook
      } catch (error) {
        handleValidationError(error)
      }
    },

    editAuthor: async (root, args, context) => {
      requireAuth(context)

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

    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })

      if (!user || args.password !== 'secret') {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHORIZED' }
        })
      }

      const token = jwt.sign(
        { username: user.username, id: user._id },
        process.env.JWT_SECRET
      )

      return { value: token }
    }
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterableIterator('BOOK_ADDED'),
    },
  },
}

module.exports = resolvers