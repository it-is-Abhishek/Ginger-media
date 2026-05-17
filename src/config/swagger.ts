import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Intelligent Media Processing Pipeline API',
      version: '1.0.0',
      description: 'Vehicle image upload, async processing, and fraud/quality analysis APIs.',
    },
  },
  apis: [
    path.join(process.cwd(), 'src/routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
  ],
});
