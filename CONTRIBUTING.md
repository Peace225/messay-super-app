# 🤝 Guide de Contribution - MESSAY

Merci de votre intérêt pour contribuer à MESSAY! Ce document vous guidera à travers le processus de contribution.

## 📋 Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Standards de code](#standards-de-code)
- [Processus de Pull Request](#processus-de-pull-request)
- [Signaler des bugs](#signaler-des-bugs)
- [Proposer des fonctionnalités](#proposer-des-fonctionnalités)

## 📜 Code de conduite

En participant à ce projet, vous acceptez de respecter notre code de conduite:

- Soyez respectueux et inclusif
- Acceptez les critiques constructives
- Concentrez-vous sur ce qui est le mieux pour la communauté
- Faites preuve d'empathie envers les autres membres

## 🚀 Comment contribuer

### 1. Fork le projet

Cliquez sur le bouton "Fork" en haut à droite de la page du repository.

### 2. Cloner votre fork

```bash
git clone https://github.com/votre-username/messe.git
cd messe
```

### 3. Créer une branche

```bash
git checkout -b feature/ma-nouvelle-fonctionnalite
```

Conventions de nommage des branches:
- `feature/` - Nouvelles fonctionnalités
- `fix/` - Corrections de bugs
- `docs/` - Documentation
- `refactor/` - Refactoring de code
- `test/` - Ajout de tests

### 4. Faire vos modifications

Assurez-vous de:
- Suivre les standards de code
- Ajouter des tests si nécessaire
- Mettre à jour la documentation
- Tester vos modifications

### 5. Commit vos changements

```bash
git add .
git commit -m "feat: Ajouter une nouvelle fonctionnalité"
```

Format des messages de commit (Conventional Commits):
- `feat:` - Nouvelle fonctionnalité
- `fix:` - Correction de bug
- `docs:` - Documentation
- `style:` - Formatage, point-virgules manquants, etc.
- `refactor:` - Refactoring de code
- `test:` - Ajout de tests
- `chore:` - Maintenance

### 6. Push vers votre fork

```bash
git push origin feature/ma-nouvelle-fonctionnalite
```

### 7. Créer une Pull Request

Allez sur GitHub et créez une Pull Request depuis votre branche vers `main`.

## 💻 Standards de code

### TypeScript/JavaScript

- Utiliser TypeScript pour tout nouveau code
- Suivre les règles ESLint configurées
- Utiliser des noms de variables descriptifs
- Commenter le code complexe
- Éviter les `any` types

### React/React Native

- Utiliser des composants fonctionnels avec hooks
- Extraire la logique complexe dans des hooks personnalisés
- Utiliser TypeScript pour les props
- Suivre les conventions de nommage React

### Backend

- Suivre l'architecture MVC
- Valider toutes les entrées utilisateur
- Gérer les erreurs correctement
- Documenter les endpoints avec Swagger
- Écrire des tests unitaires

### Base de données

- Utiliser Prisma pour toutes les requêtes
- Créer des migrations pour les changements de schéma
- Indexer les colonnes fréquemment recherchées
- Documenter les relations complexes

## 🔍 Processus de Pull Request

1. **Vérifier que votre code compile**
   ```bash
   npm run build
   ```

2. **Exécuter les tests**
   ```bash
   npm test
   ```

3. **Vérifier le linting**
   ```bash
   npm run lint
   ```

4. **Mettre à jour la documentation**
   - README.md si nécessaire
   - Commentaires dans le code
   - Documentation API

5. **Décrire vos changements**
   - Titre clair et descriptif
   - Description détaillée des modifications
   - Captures d'écran si UI
   - Référence aux issues liées

6. **Attendre la review**
   - Répondre aux commentaires
   - Faire les modifications demandées
   - Être patient et respectueux

## 🐛 Signaler des bugs

### Avant de signaler

- Vérifier que le bug n'a pas déjà été signalé
- Vérifier que vous utilisez la dernière version
- Essayer de reproduire le bug

### Comment signaler

Créer une issue avec:

**Titre**: Description courte et claire

**Description**:
- Comportement attendu
- Comportement actuel
- Étapes pour reproduire
- Environnement (OS, version Node, etc.)
- Captures d'écran si applicable
- Logs d'erreur

**Template**:
```markdown
## Description
[Description claire du bug]

## Étapes pour reproduire
1. Aller à '...'
2. Cliquer sur '...'
3. Voir l'erreur

## Comportement attendu
[Ce qui devrait se passer]

## Comportement actuel
[Ce qui se passe réellement]

## Environnement
- OS: [ex: Windows 11]
- Node: [ex: 18.17.0]
- Version: [ex: 1.0.0]

## Logs
```
[Coller les logs ici]
```

## Captures d'écran
[Si applicable]
```

## 💡 Proposer des fonctionnalités

### Avant de proposer

- Vérifier que la fonctionnalité n'existe pas déjà
- Vérifier qu'elle n'a pas déjà été proposée
- S'assurer qu'elle correspond à la vision du projet

### Comment proposer

Créer une issue avec:

**Titre**: [FEATURE] Description de la fonctionnalité

**Description**:
- Problème résolu
- Solution proposée
- Alternatives considérées
- Impact sur le projet

**Template**:
```markdown
## Problème
[Quel problème cette fonctionnalité résout-elle?]

## Solution proposée
[Comment voulez-vous résoudre ce problème?]

## Alternatives
[Quelles autres solutions avez-vous considérées?]

## Contexte additionnel
[Informations supplémentaires, mockups, etc.]
```

## 📝 Checklist avant de soumettre

- [ ] Mon code suit les standards du projet
- [ ] J'ai commenté mon code, particulièrement les parties complexes
- [ ] J'ai mis à jour la documentation
- [ ] Mes changements ne génèrent pas de nouveaux warnings
- [ ] J'ai ajouté des tests qui prouvent que ma correction/fonctionnalité fonctionne
- [ ] Les tests unitaires passent localement
- [ ] Les changements dépendants ont été mergés et publiés

## 🎯 Domaines de contribution

Nous recherchons particulièrement de l'aide sur:

- 🐛 Corrections de bugs
- 📝 Amélioration de la documentation
- 🧪 Ajout de tests
- 🌍 Traductions
- ♿ Accessibilité
- 🎨 Améliorations UI/UX
- ⚡ Optimisations de performance

## 📞 Questions?

Si vous avez des questions, n'hésitez pas à:
- Ouvrir une issue avec le tag `question`
- Contacter l'équipe sur GitHub Discussions

## 🙏 Merci!

Merci de contribuer à MESSAY! Chaque contribution, petite ou grande, est appréciée.

---

**Fait avec ❤️ par la communauté MESSAY**
