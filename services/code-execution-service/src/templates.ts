// ============================================
// Project Template Manager
// Manages scaffolding templates for generated company products.
// ============================================

import { createLogger } from '@acbi/utils';

const logger = createLogger('code-execution-service:templates');

export interface TemplateFile {
  path: string;
  content: string;
}

export interface ProjectTemplate {
  name: string;
  description: string;
  files: TemplateFile[];
}

export interface ScaffoldConfig {
  companyName: string;
  projectName?: string;
  description?: string;
}

export class ProjectTemplateManager {
  private readonly templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.registerTemplates();
  }

  /**
   * Get a template by name.
   */
  getTemplate(name: string): ProjectTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * List all available templates.
   */
  listTemplates(): Array<{ name: string; description: string; fileCount: number }> {
    return Array.from(this.templates.values()).map((t) => ({
      name: t.name,
      description: t.description,
      fileCount: t.files.length,
    }));
  }

  /**
   * Scaffold a project from a template with the given config.
   * Replaces placeholder values (e.g. company name) in file contents.
   */
  scaffoldProject(templateName: string, config: ScaffoldConfig): ProjectTemplate | null {
    const template = this.templates.get(templateName);
    if (!template) {
      logger.warn({ templateName }, 'Template not found');
      return null;
    }

    logger.info(
      { templateName, companyName: config.companyName },
      'Scaffolding project from template',
    );

    const projectName = config.projectName ?? config.companyName.toLowerCase().replace(/\s+/g, '-');
    const description = config.description ?? `${config.companyName} web application`;

    const scaffoldedFiles = template.files.map((file) => ({
      path: file.path,
      content: file.content
        .replace(/\{\{COMPANY_NAME\}\}/g, config.companyName)
        .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
        .replace(/\{\{DESCRIPTION\}\}/g, description),
    }));

    return {
      name: template.name,
      description: template.description,
      files: scaffoldedFiles,
    };
  }

  /**
   * Register all built-in templates.
   */
  private registerTemplates(): void {
    // --- nextjs-supabase (MVP default) ---
    this.templates.set('nextjs-supabase', {
      name: 'nextjs-supabase',
      description: 'Next.js application with Supabase backend - the default MVP template',
      files: [
        {
          path: 'package.json',
          content: JSON.stringify(
            {
              name: '{{PROJECT_NAME}}',
              version: '0.1.0',
              private: true,
              scripts: {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
                lint: 'next lint',
              },
              dependencies: {
                next: '^14.2.0',
                react: '^18.3.0',
                'react-dom': '^18.3.0',
                '@supabase/supabase-js': '^2.43.0',
              },
              devDependencies: {
                typescript: '^5.4.0',
                '@types/node': '^20.12.0',
                '@types/react': '^18.3.0',
                '@types/react-dom': '^18.3.0',
              },
            },
            null,
            2,
          ),
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify(
            {
              compilerOptions: {
                target: 'ES2017',
                lib: ['dom', 'dom.iterable', 'esnext'],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: 'esnext',
                moduleResolution: 'bundler',
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: 'preserve',
                incremental: true,
                plugins: [{ name: 'next' }],
                paths: { '@/*': ['./src/*'] },
              },
              include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
              exclude: ['node_modules'],
            },
            null,
            2,
          ),
        },
        {
          path: 'src/app/layout.tsx',
          content: `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '{{COMPANY_NAME}}',
  description: '{{DESCRIPTION}}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
        },
        {
          path: 'src/app/page.tsx',
          content: `export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Welcome to {{COMPANY_NAME}}</h1>
      <p>{{DESCRIPTION}}</p>
      <p>Built with Next.js and Supabase by ACBI.</p>
    </main>
  );
}
`,
        },
        {
          path: '.env.example',
          content: `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
`,
        },
        {
          path: 'next.config.js',
          content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
`,
        },
      ],
    });

    // --- nextjs-postgres (placeholder) ---
    this.templates.set('nextjs-postgres', {
      name: 'nextjs-postgres',
      description: 'Next.js application with PostgreSQL database (placeholder - coming soon)',
      files: [
        {
          path: 'README.md',
          content: `# {{COMPANY_NAME}}

{{DESCRIPTION}}

> This template is a placeholder. Full implementation coming in Phase 2.
`,
        },
      ],
    });

    // --- react-vite (placeholder) ---
    this.templates.set('react-vite', {
      name: 'react-vite',
      description: 'React SPA with Vite bundler (placeholder - coming soon)',
      files: [
        {
          path: 'README.md',
          content: `# {{COMPANY_NAME}}

{{DESCRIPTION}}

> This template is a placeholder. Full implementation coming in Phase 2.
`,
        },
      ],
    });

    logger.info(
      { templateCount: this.templates.size },
      'Project templates registered',
    );
  }
}
