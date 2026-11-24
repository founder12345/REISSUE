# REISSUE — MASTER PRODUCT ENGINEERING PROMPT

Act as a world-class founding CTO, principal software engineer, search infrastructure architect, marketplace specialist and product designer.

Your mission is to build REISSUE into an exceptionally polished, fully functional, production-oriented startup MVP capable of being demonstrated to Y Combinator, leading venture capital firms, independent brands and early customers.

Do not build a generic SaaS template, landing page or superficial prototype. Build a real consumer product with functional infrastructure.

## 1. PRODUCT VISION

**Company:** REISSUE
**Tagline:** Bring back what you love.
**Parent company:** Conditra Studio

REISSUE is a global discovery engine and demand-driven marketplace for discontinued products.

It enables people to discover, search for, catalogue and request products that are no longer manufactured.

Consumers collectively demonstrate demand for discontinued products. Original brands can use this demand to assess whether bringing a product back into production makes commercial sense.

REISSUE sits between consumers and manufacturers without owning inventory.

Imagine the product quality of Luma, the discovery experience of Pinterest, the marketplace mechanics of StockX, the community participation of Kickstarter and the search capabilities of a specialised search engine.

Create an original identity rather than directly copying these companies.

## 2. NON-NEGOTIABLE REQUIREMENTS

- Do not integrate AI in this version.
- Do not use LLM APIs, embeddings or AI-generated search results.
- Do not require paid third-party APIs for the core functionality.
- Build genuinely functional search infrastructure.
- Every important button, filter, interaction and navigation element must work.
- Never fabricate live demand, brand partnerships, reviews or commercial activity.
- Clearly label demonstration data.
- Prioritise security, performance, accessibility and maintainability.
- Build a responsive experience across desktop, tablet and mobile.
- Architect the system so AI can be integrated later without rebuilding the application.
- Avoid unnecessary complexity in infrastructure, but make the user-facing capabilities sophisticated.

Inspect the existing repository before making architectural decisions. Preserve useful existing functionality and avoid unrelated destructive changes.

## 3. VISUAL IDENTITY

Create one of the most beautifully designed consumer marketplace experiences possible.

The experience should feel like an independent Scandinavian design magazine combined with a premium modern technology company.

### Design system

- Warm off-white: #F7F6F2
- Deep charcoal: #191B18
- Forest green: #263E32
- Soft sage: #DCE5D5
- Muted grey: #92958E
- Subtle warm borders: #E5E3DC

Use forest green as the primary action colour.

Typography should combine refined editorial headlines with a highly legible modern sans-serif interface.

Use generous whitespace, strong typographic hierarchy, beautifully cropped product imagery, subtle animations and restrained visual details.

### Avoid

- Generic purple AI gradients.
- Excessive rounded cards.
- Unnecessary glassmorphism.
- Huge empty hero sections.
- Excessive badges.
- Generic startup illustrations.
- Corporate dashboard aesthetics on consumer pages.
- Artificial social proof.
- Excessive animation.
- Emoji-based navigation.
- Cookie-cutter component-library styling.

The product must feel deliberately art-directed.

Create a distinctive minimalist REISSUE wordmark and original favicon using vector graphics.

## 4. TECHNICAL ARCHITECTURE

Use the existing technology stack if suitable. Otherwise, prefer:

- Next.js with App Router.
- React and TypeScript in strict mode.
- Tailwind CSS with custom design tokens.
- PostgreSQL.
- Secure database-backed authentication.
- Object storage for authorised product images.
- PostgreSQL full-text search and trigram similarity.
- Zod or equivalent schema validation.
- Lightweight motion library or CSS transitions.
- Vercel-compatible deployment architecture.
- Automated unit, integration and end-to-end testing.

Use open-source libraries where beneficial.

Avoid requiring expensive infrastructure. The application should be capable of running locally and initially operating on a low-cost or free infrastructure tier, subject to provider limits.

Create clean abstractions for search, storage, notifications, authentication, analytics and future AI services.

Do not implement an AI service yet.

## 5. LANDING AND DISCOVERY EXPERIENCE

Build an exceptional homepage.

### Navigation

- REISSUE wordmark.
- Explore.
- Collections.
- Campaigns.
- For Brands.
- Search.
- Saved products.
- User account.

### Hero

Headline:

"Good things deserve a second life."

Supporting text:

"Discover discontinued favourites, rally a community and bring them back."

Place a prominent universal search bar directly beneath the headline.

Search placeholder:

"Find something you wish still existed..."

The hero should prioritise product discovery rather than marketing copy.

### Homepage sections

- Recently rediscovered.
- Most requested comebacks.
- Products gaining momentum.
- Explore by category.
- Community collections.
- Recently added to the archive.
- How REISSUE works.
- Brand participation information.

All sections must use real database queries rather than hardcoded interface elements.

If no real activity exists, show meaningful empty states or explicitly labelled demonstration content.

## 6. BUILD THE REISSUE SEARCH ENGINE

Search is the foundation of the entire company.

Create a sophisticated, deterministic product discovery system without using AI.

### Search capabilities

- Full-text product search.
- Brand search.
- Model and reference number search.
- SKU and manufacturer identifier search.
- Partial word matching.
- Prefix matching.
- Fuzzy matching.
- Typo tolerance.
- Case-insensitive search.
- Accent-insensitive search.
- Product aliases.
- Alternative spellings.
- Synonym dictionaries.
- Historical product names.
- Category matching.
- Year and decade filtering.
- Exact phrase searches.
- Multi-word query handling.
- Search history for opted-in authenticated users.
- Popular searches based on genuine aggregated activity.
- Search suggestions.
- Related products based on structured attributes.
- Search result highlighting.
- Cursor-based pagination.
- Shareable search URLs.

For example, a user searching for:

"old navy arcteryx jacket"

should receive relevant results based on brand aliases, colour, product type, release date and matching catalogued descriptions.

Do not generate imaginary matching products.

### Search ranking

Create a configurable relevance ranking system using:

- Exact product identifier matches.
- Exact product name matches.
- Brand relevance.
- Product title similarity.
- Full-text relevance.
- Attribute matches.
- Alias and synonym matches.
- Catalogue verification quality.
- Genuine community engagement.

Relevance must remain the default priority. Popularity should not overwhelm an exact match.

Expose ranking weights in a central configuration file and test them using representative search queries.

### Search interface

Implement an elegant command-palette-style search overlay with:

- Instant autocomplete.
- Keyboard navigation.
- Recent searches.
- Matching products.
- Matching brands.
- Matching categories.
- Relevant campaigns.
- Search result counts.
- Debounced requests.
- Loading skeletons.

Ensure rapid typing does not cause stale responses to replace newer results.

### Advanced search filters

Allow users to filter by:

- Category.
- Subcategory.
- Brand.
- Release year.
- Discontinuation year.
- Decade.
- Original retail price.
- Colour.
- Material.
- Product availability.
- Country of origin.
- Campaign status.
- Community demand.
- Verification status.

Support multi-select filters, clear-all functionality, sorting, mobile filter drawers and persistent URL state.

### Search analytics

Create privacy-conscious analytics for:

- Search volume.
- Queries returning no results.
- Frequently requested products.
- Search-to-product conversion.
- Search-to-campaign conversion.
- Emerging search trends.

Avoid invasive user tracking.

## 7. THE GLOBAL PRODUCT ARCHIVE

Build a structured database of discontinued products.

Initial categories:

- Fashion.
- Footwear.
- Technology.
- Audio.
- Watches.
- Accessories.
- Furniture.
- Design objects.
- Photography.
- Outdoor equipment.
- Collectibles.

Every product should support:

- Product name.
- Brand.
- Model.
- Reference number.
- SKU.
- Description.
- Release year.
- Discontinuation year.
- Original retail price and currency.
- Category and subcategory.
- Colours.
- Materials.
- Specifications.
- Product images.
- Image attribution.
- Historical information.
- Product aliases.
- Official product links where available.
- Product lifecycle status.
- Source references.
- Verification status.
- Community demand statistics.
- Associated comeback campaigns.

Distinguish confirmed discontinued products from products whose current availability is unknown.

Never present uncertain catalogue information as verified fact.

Build a catalogue ingestion system supporting:

- CSV import.
- JSON import.
- Manual administrator entry.
- Community submissions.
- Brand-submitted catalogues.
- Duplicate detection.
- Field validation.
- Import previews.
- Import error reports.
- Source attribution.
- Moderation workflows.

Do not perform unauthorised scraping or bypass website access controls.

Use properly licensed or authorised imagery. Use original placeholders where suitable images are unavailable.

Include a clearly labelled demonstration catalogue for local development.

## 8. PRODUCT DETAIL PAGES

Create beautiful editorial product pages that feel like digital museum exhibits.

Each page should include:

- Large product photography gallery.
- Brand and product name.
- Product history.
- Release and discontinuation information.
- Original retail price.
- Product specifications.
- Source information.
- Community demand.
- Associated comeback campaign.
- Related archival products.
- Save button.
- Share button.
- Report incorrect information.
- Request a comeback button.

Allow users to suggest corrections and submit additional evidence.

Create a prominent central action:

"Bring it back"

Product pages must be shareable, indexable where appropriate and include properly configured metadata.

## 9. COMEBACK CAMPAIGNS

Build the core marketplace mechanism.

Users can initiate campaigns requesting that original manufacturers bring back specific products.

Campaign creation should include:

- Select an existing product.
- Submit a missing product.
- Campaign title.
- Campaign description.
- Desired product specifications.
- Suggested retail price.
- Preferred product variants.
- Reasons for requesting the revival.

Other users can register interest.

Collect optional, non-binding information about:

- Preferred price.
- Quantity.
- Preferred size or variant.
- Country.
- Likelihood of purchase.

Clearly communicate that registering interest is not placing an order.

### Campaign statuses

- Gathering interest.
- Under moderation.
- Ready for brand outreach.
- Brand contacted.
- Under brand review.
- Brand approved.
- Brand declined.
- Completed.
- Archived.

Brand-related statuses must only be applied after authorised administrators or verified brand representatives provide evidence.

### Campaign pages

Include:

- Campaign product imagery.
- Genuine supporter counts.
- Progress towards a clearly defined interest target.
- Anonymous price preference distribution.
- Recent genuine campaign milestones.
- Community discussion.
- Shareable campaign links.
- Campaign updates.

Prevent duplicate interest registrations, spam and artificial vote manipulation.

Do not integrate payments, deposits or binding preorders in V1.

## 10. COMMUNITY

Build a focused community around products, design and nostalgia.

Users should be able to:

- Create profiles.
- Save products.
- Follow campaigns.
- Create collections.
- Publish public collections.
- Maintain private collections.
- Submit products.
- Suggest catalogue corrections.
- Comment on campaigns.
- Follow brands.
- Receive campaign updates.
- Report inappropriate content.

Build moderation, rate limiting and reporting tools.

Do not expose private contact details or individual purchasing preferences.

Avoid unnecessary private messaging functionality in V1.

## 11. COLLECTIONS

Allow users to curate collections of discontinued products.

Example collections:

- The Golden Age of iPod Design.
- Forgotten Japanese Workwear.
- Classic Digital Watches.
- Early 2000s Industrial Design.
- Archival Outdoor Equipment.

Each collection should have an editorial cover, description, curator, product grid and shareable link.

Create an elegant browsing experience inspired by design archives and digital museums.

## 12. BRAND PORTAL

Build a separate, highly refined dashboard for verified brands.

The brand portal is a critical part of the business model.

Enable brands to understand consumer demand for their discontinued products.

### Dashboard features

- Total campaign interest.
- Most requested products.
- Demand growth over time.
- Preferred retail price distributions.
- Aggregated geographical demand.
- Requested product variants.
- Historical campaign performance.
- Brand catalogue management.
- CSV export.
- Campaign review tools.
- Product revival announcements.

Do not represent stated purchase intent as guaranteed revenue.

Brands should be able to:

- Request ownership of their brand profile.
- Submit verification information.
- Import historical catalogues.
- Review comeback campaigns.
- Respond to community demand.
- Publish official campaign updates.
- Approve or decline campaigns.

Brand access must require verification and appropriate permissions.

Do not automatically grant brand ownership based solely on a submitted company name.

## 13. ADMINISTRATION AND MODERATION

Build a secure internal administration interface.

Include:

- User management.
- Brand verification.
- Product moderation.
- Catalogue editing.
- Campaign moderation.
- Report management.
- Duplicate product merging.
- Category management.
- Search synonym management.
- Search analytics.
- Import management.
- Audit logs.
- Platform settings.

Use role-based permissions with server-side enforcement.

Record sensitive administrative actions in audit logs.

Provide soft deletion and recovery where appropriate.

## 14. DATABASE DESIGN

Design a normalised relational database with migrations.

Include appropriate entities for:

- Profiles.
- Roles.
- Brands.
- Brand ownership requests.
- Brand members.
- Products.
- Product aliases.
- Product images.
- Product sources.
- Product attributes.
- Categories.
- Campaigns.
- Campaign supporters.
- Campaign updates.
- Campaign comments.
- Collections.
- Collection items.
- Saved products.
- Brand follows.
- Notifications.
- Product submissions.
- Correction requests.
- Search events.
- Search synonyms.
- Moderation reports.
- Import jobs.
- Audit logs.

Create proper foreign keys, unique constraints, search indexes and pagination indexes.

Implement transactional operations wherever consistency matters.

Users must never be able to modify another user's data or obtain unauthorised administrative access.

## 15. FUTURE AI ARCHITECTURE

Do not implement AI functionality now.

However, make the architecture compatible with future additions such as:

- Image-based product identification.
- Semantic product search.
- Natural-language product discovery.
- Automatic catalogue enrichment.
- Product duplicate suggestions.
- Personalised recommendations.
- Demand forecasting.
- Automated source extraction.

Keep the deterministic search engine independent from future AI providers.

The entire platform must remain functional if AI services are unavailable.

## 16. BUSINESS MODEL READINESS

Prepare the architecture for future monetisation through:

- Commissions on successful product revivals.
- Optional brand intelligence subscriptions.
- Enterprise demand analytics.
- Authorised commercial partnerships.

Keep consumer search, discovery and campaign participation free.

Do not activate billing, payments or paid subscriptions during this development phase.

Do not build misleading checkout interfaces.

## 17. SECURITY AND PRIVACY

Implement security as a fundamental requirement.

Include:

- Server-side authorisation.
- Role-based access control.
- Secure authentication.
- Input validation.
- Parameterised database queries.
- Protection against SQL injection and XSS.
- Appropriate CSRF protections.
- Secure session handling.
- Rate limiting.
- Safe file upload validation.
- Spam prevention.
- Private environment variables.
- Restricted storage permissions.
- Account deletion.
- Privacy-conscious analytics.
- Audit logging.
- Data minimisation.

Do not expose secrets in client bundles.

Do not collect unnecessary personal information.

Review applicable privacy and consumer protection requirements before production launch.

## 18. PERFORMANCE AND ACCESSIBILITY

Target excellent real-world performance.

Implement:

- Optimised images.
- Lazy loading.
- Server-rendered catalogue pages where appropriate.
- Efficient indexed search queries.
- Cache strategies.
- Cursor pagination.
- Minimal unnecessary client-side JavaScript.
- Responsive image sizing.
- Accessible forms.
- Keyboard navigation.
- Visible focus states.
- Reduced-motion support.
- Screen-reader labels.
- WCAG AA-oriented colour contrast.

Test on both desktop and mobile viewport sizes.

## 19. TESTING

Build automated tests covering:

- Search relevance.
- Typo tolerance.
- Exact product reference matching.
- Filtering combinations.
- Search pagination.
- Authentication.
- Permission enforcement.
- Product submissions.
- Duplicate prevention.
- Campaign creation.
- Interest registration.
- Campaign withdrawal.
- Collections.
- Brand verification.
- Administrator actions.
- CSV imports.
- Invalid data handling.
- Account deletion.
- Responsive navigation.

Test complete user journeys, not only individual components.

The central journey must work:

Search → Discover product → View archive page → Join comeback campaign → Save product → Receive campaign update.

Another central journey must work:

Brand registration → Verification → Demand dashboard → Review campaign → Publish authorised response.

Run the available tests, type checking, linting and production build. Resolve failures rather than hiding them.

## 20. IMPLEMENTATION STRATEGY

Work systematically through the following phases:

Phase 1: Repository inspection, architectural decisions and database foundation.

Phase 2: Design system, responsive application shell and navigation.

Phase 3: Product catalogue, import infrastructure and deterministic search engine.

Phase 4: Discovery pages, product pages and collections.

Phase 5: Authentication, user accounts and comeback campaigns.

Phase 6: Brand portal and administrative moderation.

Phase 7: Security, accessibility, performance and automated testing.

Phase 8: Final visual refinement and deployment readiness.

Do not stop after creating a plan. Implement the application.

Prioritise a complete functional vertical slice before expanding secondary features. If implementation limits prevent completing everything, clearly document unfinished functionality instead of creating fake working interfaces.

## 21. FINAL DELIVERABLES

Deliver:

- Working application source code.
- Complete database schema and migrations.
- Deterministic search infrastructure.
- Clearly labelled development seed data.
- Environment variable template.
- Setup instructions.
- Deployment instructions.
- Automated tests.
- Architecture documentation.
- Search ranking documentation.
- Security considerations.
- Known limitations.
- Future AI integration roadmap.

At completion, provide an accurate report of:

- Features implemented.
- Tests actually executed and their results.
- Remaining bugs or limitations.
- Required external configuration.
- Deployment readiness.
- Recommended next development priorities.

The final result should not look or behave like a weekend hackathon project.

It should feel like a credible venture-backed consumer internet company preparing for its first public launch.

Build REISSUE to become the world's definitive archive of discontinued products and the marketplace for bringing them back.

Make it beautiful. Make it fast. Make it functional. Make it original.

Begin implementation now.