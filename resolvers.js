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
    allAuthors: async () => {
    const bookCounts = await Book.aggregate([
      {$match:  { author: { $ne: null } } },
      { $group: { _id: '$author', count: { $sum: 1 } } }
    ])

    const countMap = bookCounts.reduce((map, entry) => {
      map[entry._id.toString()] = entry.count
      return map
    }, {})

    const authors = await Author.find({})

    return authors.map(author => ({
      id: author._id.toString(),
      name: author.name,
      born: author.born,
      bookCount: countMap[author._id.toString()] || 0
    }))
  },

    me: (root, args, context) => {
    return context.currentUser
    },
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