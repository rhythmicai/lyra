module.exports = {
  Octokit: jest.fn().mockImplementation(() => ({
    search: {
      issuesAndPullRequests: jest.fn()
    },
    pulls: {
      get: jest.fn(),
      listFiles: jest.fn()
    }
  }))
};