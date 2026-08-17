// Loads the real .env so integration specs connect to the same MongoDB the
// app itself uses in dev — matches this project's existing convention of
// live-testing against real Mongo rather than an in-memory substitute.
require('dotenv').config();
