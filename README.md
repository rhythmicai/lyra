# 🔍 Lyra

AI-powered GitHub repository analysis tool that provides comprehensive code quality assessments, identifies improvement opportunities, and tracks development patterns.

## Features

- **Personalized Coaching**: AI-generated development coaching from a senior engineer perspective
- **Team Analysis**: Analyze any GitHub user's contributions - perfect for dev managers reviewing team members
- **Comprehensive PR Analysis**: Analyzes pull requests for code quality, test coverage, and best practices
- **AI-Powered Insights**: Uses GPT-4 to generate specific, actionable recommendations
- **Flexible Selection**: Choose PRs by recency, size, time frame, or custom criteria
- **Multi-Repository Support**: Analyze single repos or entire organizations
- **Detailed Metrics**: Track test coverage, documentation, security patterns, and more
- **Beautiful Reports**: Generates markdown reports with clear findings and recommendations

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lyra.git
cd lyra

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## Setup

1. **Create a GitHub Personal Access Token**
   - Go to https://github.com/settings/tokens
   - Generate a new token with `repo` and `read:org` scopes
   
2. **Get an OpenAI API Key**
   - Visit https://platform.openai.com/api-keys
   - Create a new API key

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your tokens
   ```

## Usage

### Interactive Mode

```bash
lyra analyze
```

This will prompt you for:
- Review focus areas (e.g., test coverage, architecture, security)
- PR selection criteria (last N, largest, by timeframe)
- Repository filter (optional)
- Language filter (optional)

### Quick Analysis

```bash
# Analyze with sensible defaults
lyra quick

# Analyze specific repository
lyra quick --repo owner/repository
```

### Command Line Options

```bash
lyra analyze [options]

Options:
  -u, --user <username>     GitHub username to analyze (defaults to authenticated user)
  -f, --focus <areas>        Review focus areas (default: "test coverage, code quality")
  -s, --selection <criteria> PR selection (e.g., "last 10", "largest 5")
  -r, --repo <repo>         Repository filter (e.g., "owner/repo")
  -l, --language <langs>    Language filter (comma-separated)
  -o, --output <dir>        Output directory (default: "./insights")
  --no-interactive          Skip interactive prompts
```

### Examples

```bash
# Analyze a team member's contributions
lyra analyze -u "octocat" -f "test coverage, code quality" -s "last 20"

# Quick analysis of a specific developer
lyra quick -u "teammate-username"

# Analyze last 20 PRs focusing on test coverage
lyra analyze -f "test coverage, testing patterns" -s "last 20"

# Analyze largest PRs in specific repo
lyra analyze -r "facebook/react" -s "largest 10" -f "architecture, performance"

# Team member analysis with specific repo
lyra analyze -u "developer123" -r "myorg/myrepo" -s "last-week"

# Analyze TypeScript files from last week
lyra analyze -s "last-week" -l "typescript" -f "type safety, best practices"
```

### Team Management Use Cases

For development managers and team leads:

```bash
# Weekly team member review
lyra analyze -u "team-member" -s "last-week" -f "code quality, test coverage"

# Quarterly performance review data
lyra analyze -u "developer" -s "last 90" -f "architecture, documentation, testing"

# New team member onboarding assessment
lyra analyze -u "new-hire" -s "last 30" -f "coding standards, best practices"

# Cross-team collaboration analysis
lyra analyze -u "developer" -r "other-team/repo" -s "last 20"
```

## Output

The tool generates comprehensive reports in the specified output directory:

```
./insights/
└── 2025-01-15/
    └── analysis-2025-01-15T10-30-00/
        ├── COMPREHENSIVE_ASSESSMENT.md  # Main analysis report
        ├── analysis-data.json          # Raw data and metrics
        └── activity-report.json        # GitHub activity overview
```

## Report Contents

Each analysis generates three key files:

### 1. **COACHING_ADVICE.md** - Personalized Development Coaching
   - Warm, encouraging feedback from a senior engineer perspective
   - Recognition of your strengths based on data
   - Specific growth opportunities with examples
   - 30/60/90 day skill development plan
   - Resource recommendations and practical tips
   - Motivational guidance for continuous improvement

### 2. **COMPREHENSIVE_ASSESSMENT.md** - Technical Analysis
   - Executive summary with key metrics
   - Detailed code quality metrics
   - Test coverage and documentation ratios
   - PR size and merge rate analysis
   - Risk assessment (high/medium/low)
   - Specific technical recommendations

### 3. **analysis-data.json** - Raw Data
   - Complete PR metadata
   - Detailed metrics per PR
   - Configuration used
   - Raw data for custom analysis

## Architecture

The tool uses a LangGraph React agent architecture:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   GitHub    │────▶│  LangGraph   │────▶│   OpenAI    │
│   Tools     │     │    Agent     │     │   GPT-4     │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Analysis   │
                    │   Report     │
                    └──────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Observability with LangSmith

This tool includes built-in observability using [LangSmith](https://smith.langchain.com/) to track AI operations and performance.

### Setup LangSmith (Optional)

1. **Create a LangSmith account** at https://smith.langchain.com/
2. **Get your API key** from the settings page
3. **Add LangSmith configuration** to your `.env` file:

```bash
# LangSmith Configuration (optional)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=lyra
```

### What Gets Traced

With LangSmith enabled, you can observe:

- **Main analysis workflow**: Complete GitHub analysis pipeline
- **Individual step performance**: Overview generation, PR selection, analysis, etc.
- **AI model calls**: OpenAI API interactions for insights and coaching
- **GitHub API interactions**: Search queries, PR fetching, and metrics analysis
- **Error tracking**: Failed operations and their contexts

### Benefits

- **Performance monitoring**: Track analysis speed and identify bottlenecks
- **Quality assurance**: Review AI-generated insights and coaching advice
- **Usage analytics**: Understand which analysis types are most common
- **Debugging**: Trace issues in the analysis pipeline
- **Cost tracking**: Monitor OpenAI API usage and costs

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [LangChain](https://langchain.com/) and [LangGraph](https://github.com/langchain-ai/langgraph)
- Powered by [OpenAI GPT-4](https://openai.com/)
- GitHub API via [Octokit](https://github.com/octokit/rest.js)

## Support

- 🐛 [Report Issues](https://github.com/yourusername/lyra/issues)
- 💬 [Discussions](https://github.com/yourusername/lyra/discussions)
- 📧 Contact: your.email@example.com