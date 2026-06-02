const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    minlength: 3
  },
  favoriteGenre: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Genre'
    }
  ],
})

module.exports = mongoose.model('User', schema)