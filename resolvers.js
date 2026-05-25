

const resolvers = {
  Query: {
    bookCount: () => books.length,
    authorCount: () => authors.length,
    allBooks: (root, args) => {
      let filteredBooks = books

      if (args.author) {
        filteredBooks = filteredBooks.filter(book => book.author === args.author)
      }

      if (args.genre) {
        filteredBooks = filteredBooks.filter(book => book.genres.includes(args.genre))
      }

      return filteredBooks
    },
    allAuthors: () => authors,
  },

  Author: {
    name: (root) => root.name,
    id: (root) => root.id,
    born: (root) => root.born,
    bookCount: (root) => {
      const authorName = root.name
      return books.filter(book => book.author === authorName).length
    }
  },

  Book: {
    title: (root) => root.title,
    published: (root) => root.published,
    author: (root) => root.author,
    id: (root) => root.id,
    genres: (root) => root.genres
  },

  Mutation: {
    addBook: (root, args) => {
      const newBook = {
        title: args.title,
        published: args.published,
        author: args.author,
        id: uuid(),
        genres: args.genres
      }
      books.push(newBook)

      if (!authors.find(a => a.name === args.author)) {
        authors.push({ name: args.author, id: uuid() })
      }

      return newBook
    },

    editAuthor: (root, args) => {
      const author = authors.find(a => a.name === args.name)
      if (!author) {
        return null
      }
      author.born = args.setBornTo
      return author
    }
  }
}