import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MESSAY API Documentation',
      version: '1.0.0',
      description: 'API REST pour la Super App MESSAY - Plateforme de Mobilité & Logistique en Côte d\'Ivoire.',
      contact: {
        name: 'MESSAY Support',
        email: 'support@messay.com',
      },
    },
    servers: [
      {
        // 🚩 UTILISE TON IP LOCALE ICI (indispensable pour le téléphone)
        url: 'http://192.168.1.7:5000', 
        description: 'Serveur Local (Développement)',
      },
      {
        url: 'http://localhost:5000',
        description: 'Localhost',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nom: { type: 'string' },
            prenom: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['USER', 'CONDUCTEUR', 'CHAUFFEUR', 'ADMIN'] },
          },
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            prix: { type: 'number' },
            statut: { type: 'string', enum: ['EN_ATTENTE', 'ACCEPTEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'] },
          },
        },
      },
    },
  },
  // 🚩 LA CORRECTION EST ICI : On vide le tableau pour que Swagger arrête de scanner les commentaires mal indentés.
  apis: [], 
};

// Bloc de sécurité pour éviter le crash si la génération échoue
let swaggerSpec = {};
try {
  swaggerSpec = swaggerJsdoc(options);
} catch (error) {
  console.error('❌ Erreur lors de la génération de Swagger :', error);
}

export default swaggerSpec;