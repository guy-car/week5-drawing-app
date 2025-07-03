module.exports = {
  preset: 'jest-expo',
  transform: { '^.+\\.(ts|tsx)$': 'ts-jest' },
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
}; 