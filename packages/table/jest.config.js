module.exports = {
  moduleFileExtensions: [
    'js',
    'json',
    'vue'
  ],
  transform: {
    '.*\\.(vue)$': 'vue-jest',
    '^.+\\.js$': 'babel-jest'
  },
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|scss)$': 'identity-obj-proxy'
  },
  collectCoverage: true
};
