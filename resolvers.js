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
        author = new Author({ name: args.author })
        await author.save()
      }

      const book = new Book({
        title: args.title,
        published: args.published,
        author: author._id,
        genres: args.genres,
      })

      try {
        await book.save()
      } catch (error) {
        handleValidationError(error)
      }
      return book.populate('author')
    },

    editAuthor: async (root, args) => {
      const author = await Author.findOneAndUpdate(
        { name: args.name },
        { born: args.setBornTo },
        { new: true }
      )
      return author // retorna null automaticamente se não encontrar
    },
  },
}

module.exports = resolvers