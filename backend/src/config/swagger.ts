import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MESSAY API Documentation',
      version: '1.0.0',
      description: `
        API REST pour la Super App MESSAY - Plateforme tout-en-un pour la Côte d'Ivoire
        
        ## Fonctionnalités
        - 🛺 Mobilité urbaine (Tricycles)
        - 🚌 Transport interurbain
        - 🎟️ Événements et loisirs
        - 🚜 BTP et matériaux (Lacarrière)
        - 💳 Paiements intégrés
        - 🆘 Support client 24/7
        
        ## Authentification
        La plupart des endpoints nécessitent un token JWT dans le header Authorization:
        \`\`\`
        Authorization: Bearer <votre_token>
        \`\`\`
        
        Obtenez un token en vous connectant via \`POST /api/auth/login\`
      `,
      contact: {
        name: 'MESSAY Support',
        email: 'support@messay.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Serveur de développement',
      },
      {
        url: 'https://api.messay.com',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Entrez votre token JWT obtenu lors de la connexion',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nom: { type: 'string', example: 'Kouassi' },
            prenom: { type: 'string', example: 'Jean' },
            email: { type: 'string', format: 'email', example: 'jean.kouassi@example.com' },
            telephone: { type: 'string', example: '+2250701234567' },
            role: { type: 'string', enum: ['USER', 'CONDUCTEUR', 'CHAUFFEUR', 'ADMIN'] },
            photo: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
          },
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            conducteurId: { type: 'string', format: 'uuid', nullable: true },
            departLatitude: { type: 'number', example: 5.3599517 },
            departLongitude: { type: 'number', example: -4.0082563 },
            departAdresse: { type: 'string', example: 'Cocody, Angré' },
            destinationLatitude: { type: 'number', example: 5.3247 },
            destinationLongitude: { type: 'number', example: -4.0127 },
            destinationAdresse: { type: 'string', example: 'Plateau, Centre-ville' },
            distance: { type: 'number', example: 8.5 },
            dureeEstimee: { type: 'integer', example: 25 },
            prix: { type: 'number', example: 2200 },
            statut: { 
              type: 'string', 
              enum: ['EN_ATTENTE', 'ACCEPTEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'] 
            },
            partageTrajet: { type: 'boolean' },
            noteConducteur: { type: 'number', minimum: 1, maximum: 5, nullable: true },
            commentaire: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Message d\'erreur' },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentification',
        description: 'Endpoints pour l\'inscription, connexion et gestion des utilisateurs',
      },
      {
        name: 'Courses',
        description: 'Gestion des courses de tricycles',
      },
      {
        name: 'Santé',
        description: 'Vérification de l\'état de l\'API',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
