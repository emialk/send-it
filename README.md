# Send It!

Climbing Competition Scoring App — MVP

Build a responsive web application for managing climbing competitions. The application must support multiple climbing disciplines, including:

Bouldering

Lead climbing

Top-rope climbing

The application should work well on desktop/tablet for administrators and on mobile phones for competitors. It should also have a full-screen public scoreboard suitable for displaying on a TV or projector.



0. MANDATORY HOSTING AND DEPLOYMENT ARCHITECTURE

This requirement is critical.

The finished application must be deployable and runnable entirely from GitHub Pages.

Do NOT use Lovable Cloud for hosting, backend functionality, database functionality, authentication, server functions, or persistent application data.

Do NOT make the application dependent on Lovable Cloud.

The intended architecture is:

                    GitHub Pages

                         │

                         │ Static frontend

                         │

                         ▼

              React / TypeScript / Vite

                         │

                         │ HTTPS

                         ▼

                    Supabase

              ┌──────────┼──────────┐

              │          │          │

          PostgreSQL    Auth     Realtime

              │          │          │

              └──────────┴──────────┘

Frontend hosting

The frontend must consist entirely of static files that can be built and deployed to GitHub Pages.

Use:

React

TypeScript

Vite

Tailwind CSS

The production build must work with:

npm run build

and produce static assets suitable for GitHub Pages.

Do not require a Node.js server to run the application in production.

Do not require server-side rendering.

Do not require an application server.

Do not use Lovable Cloud as a runtime dependency.

Backend

Use Supabase as the backend.

Supabase should provide:

PostgreSQL database

Authentication

Row Level Security

Realtime

Storage only if actually needed

Edge Functions only where absolutely necessary

The frontend should communicate directly with Supabase using the official Supabase JavaScript client.

Use the Supabase project’s public/anon key in the frontend where appropriate.

Never expose the Supabase service-role key or other privileged credentials in frontend code.

GitHub

The project must be structured so that it can be connected to a GitHub repository and deployed using GitHub Pages.

Do not assume that Lovable will host the application.

The GitHub repository should contain the complete frontend source code and configuration necessary to build and deploy the application.

The application should not contain any hard dependency on Lovable-specific hosting infrastructure.

If Lovable-specific functionality is used during development, it must not be required by the finished application.



1. Environment configuration

Use environment variables for configuration.

At minimum support:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

These must be used by the frontend to connect to Supabase.

Do not hard-code the Supabase project URL or keys into application source code.

The Supabase anon/public key is expected to be exposed to the browser; security must instead be enforced through Supabase authentication and Row Level Security.

Do not include service-role keys in the frontend.

The application should work when deployed to a GitHub Pages URL such as:

https://USERNAME.github.io/REPOSITORY/

Take GitHub Pages’ sub-path deployment into account when configuring Vite and client-side routing.

Avoid routing approaches that break when the application is loaded directly from a GitHub Pages URL.

If using React Router, configure it appropriately for GitHub Pages deployment, including the repository base path.



2. User roles

There are three types of users:

Admin

Admins can:

Log in securely.

Create and edit competitions.

Select the climbing discipline.

Configure competition rules.

Create and edit climbing routes/problems.

Configure scoring.

Register competitors.

Generate temporary competitor access credentials/QR codes.

Start and stop competitions.

Monitor the competition live.

Correct competitor results when necessary.

Export final results.

Archive/delete competitions.

Competitor

Competitors should NOT need a normal email/password account.

Each competitor receives temporary access to a specific competition.

A competitor can:

Open their personal competition page using a QR code or temporary access token.

View their name and category.

View all routes/problems in their competition.

Record their performance.

Correct their own current results while the competition is active.

See their current total score and ranking if enabled.

A competitor must never be able to access or modify another competitor’s results.

Public viewer

The public scoreboard requires no login.

It should show:

Current rankings.

Competitor names.

Category.

Relevant climbing results.

Score.

Competition status.

Competition timer when appropriate.

The scoreboard must update automatically in real time without requiring a page refresh.



3. Competition model

Create a competitions table with at least:

id

name

description

location

date

discipline

registration_open

start_time

end_time

status

scoring_format

created_at

updated_at

Competition status should support:

draft

registration

active

finished

archived

Discipline should initially support:

bouldering

lead

top_rope

Structure the database so additional disciplines can be added later without redesigning the entire application.

An admin can create a competition while it is in draft.

Before the competition starts, the admin can configure:

Competition name

Date

Location

Discipline

Categories

Routes/problems

Scoring system

Start time

End time

Competition format



4. Competition formats

The application should distinguish between the discipline and the scoring format.

For example:

Bouldering

Possible scoring information:

Attempts

Zones

Tops

Flash

Points

Lead

Possible scoring information:

Highest hold reached

Top

Attempts

Time

Bonus/zone if the competition uses them

Top-rope

Possible scoring information:

Highest hold reached

Top

Attempts

Time

Points

Do NOT assume that every climbing competition uses the same scoring system.

The scoring model must therefore be configurable per competition.

Keep the underlying performance data sufficiently detailed that different scoring systems can be implemented later.



5. Categories

Create a categories table.

A competition can have multiple categories, for example:

Men Open

Women Open

Men Junior

Women Junior

Each competitor belongs to exactly one category within a competition.

Do not assume that these categories are fixed.

Admins should be able to create custom categories.



6. Routes and problems

Use a generic concept such as routes or climbs rather than a bouldering-specific boulders table.

Create a routes table.

Each route belongs to a competition.

Fields should include:

id

competition_id

number

name

discipline-specific metadata

maximum_score

active

created_at

updated_at

For bouldering competitions, a route represents a boulder/problem.

For lead and top-rope competitions, a route represents a climbing route.

The admin should be able to:

Add routes/problems.

Edit routes/problems.

Delete routes/problems while the competition has not started.

Reorder routes/problems.

Configure route-specific scoring information.

For bouldering, support concepts such as:

Zone

Top

Attempts

For lead/top-rope, support concepts such as:

Highest hold reached

Top

Attempts

Time

The database should not require every field to apply to every discipline.



7. Competitors

Create a competitors table.

Fields:

id

competition_id

category_id

name

competitor_number

access_token

active

created_at

updated_at

Competitor numbers should be unique within a competition.

The access token must be a cryptographically random, sufficiently long token and must not be predictable.

Do NOT use sequential IDs or competitor numbers as authentication credentials.

A competitor’s access token should only grant access to their own competitor record and results for the specific competition.



8. QR code access

Create a QR-code-based competitor login system.

After registering a competitor, the admin should be able to generate a QR code containing a URL similar to:

https://APP_DOMAIN/competitor/<temporary-token>

The actual URL/domain should be configurable and should not be hard-coded into the database.

The QR code should open the competitor’s personal scoring page on their phone.

The admin should be able to:

Display the QR code.

Print the QR code.

Regenerate/revoke a competitor’s token.

Important security requirement:

Never expose the Supabase service-role key or any privileged backend credentials in frontend code.

Do not rely solely on hiding UI elements for security. Enforce access restrictions using Supabase RLS and/or secure server-side functions.



9. Performance/results model

Create a generic competitor performance/results table, such as route_results.

Each record should associate:

competitor

competition

route/problem

with the relevant performance data.

The data model should support discipline-specific results.

For example, bouldering may record:

attempts

zone achieved

top achieved

flash

points

Lead/top-rope may record:

highest hold reached

top achieved

attempts

climbing time

points

Avoid creating completely separate databases for each discipline unless there is a strong technical reason.

Prefer a common result model with discipline-specific fields where appropriate.

The scoring engine should convert these underlying performance results into the competition’s configured score.

The underlying performance data should remain available even if the scoring algorithm changes.



10. Scoring engine

Create a configurable scoring engine.

The scoring engine must be separated from the user interface.

Do not hard-code scoring calculations into individual React components.

A competition should define which scoring system it uses.

Initially support:

Bouldering scoring

Support:

Top

Zone

Attempts

Optional flash

Configurable points

The system must allow rules such as:

Top = X points

Zone = Y points

Attempts affect score

Flash provides a bonus

Do not assume one particular bouldering scoring system.

Lead/top-rope scoring

Support:

Highest hold reached

Top

Attempts

Time

Configurable points

The system should allow a route to have a defined sequence of holds or a maximum hold number.

For example:

Route 1

Maximum hold: 40



Competitor reaches:

Hold 35



Score:

35

A Top should be represented separately from simply reaching the final numbered hold, because different competition rules may define this differently.

The scoring engine should be modular so additional scoring systems can be added later.



11. Ranking

Calculate competitor rankings from their underlying performance results.

The initial ranking system should support configurable ranking criteria.

Possible criteria include:

Total score — highest first.

Number of tops — highest first.

Number of zones — highest first.

Highest hold reached.

Attempts — lowest first.

Time — fastest/slowest depending on the competition.

Flash count.

Competition-specific tie-breaking.

Do not permanently store calculated totals if they can safely be calculated from the underlying results.

Prefer the underlying performance records as the source of truth.

Make the ranking algorithm modular so different competition formats can use different ranking rules.



12. Competition timer

The admin must be able to press:

Start Competition

This changes the competition status to active.

The admin must be able to press:

End Competition

This changes the competition status to finished.

When finished:

Competitors can no longer modify results.

The public scoreboard remains available.

The admin can export the results.

Use the database/server time as the authoritative competition time.

Do not rely on the competitor’s phone clock.

Support:

Competition start time.

Competition end time.

Countdown.

Elapsed time.

Optional route-specific time limits.

The UI should clearly communicate when competitors are allowed to submit or modify results.



13. Real-time scoreboard

Use Supabase Realtime.

When a competitor changes a result:

The result is saved to Supabase.

Connected scoreboard clients receive the update.

The scoring engine recalculates the affected ranking.

The scoreboard updates without refreshing the page.

The scoreboard should be optimized for a TV/projector.

Provide:

Full-screen layout.

Large readable typography.

Clear ranking.

Automatic updates.

Category filter.

Discipline/competition information.

Relevant route/problem results.

Competition status.

Timer.

The scoreboard must remain usable from a normal browser without requiring login.



14. Admin dashboard

Create a clean admin dashboard with:

Dashboard

Show:

Active competitions

Upcoming competitions

Finished competitions

Number of competitors

Competition status

Competition management

Admin can:

Create competition.

Edit competition.

Select discipline.

Add categories.

Add routes/problems.

Configure scoring.

Register competitors.

Generate QR codes.

Start competition.

End competition.

View live standings.

Export results.

Competitor management

Show:

Competitor number.

Name.

Category.

Access status.

QR code.

Current score.

Current ranking.

Allow an admin to manually correct results.

All admin-only operations must be protected by authentication and authorization.



15. Competitor mobile UI

The competitor page is one of the most important parts of the application.

Design it specifically for phones.

It should be extremely fast and easy to use during a climbing competition.

The interface should adapt to the selected discipline.

Example: Bouldering

Boulder 1

[ − ] Attempts [ + ]

[ Zone ]

[ TOP ]

Boulder 2

[ − ] Attempts [ + ]

[ Zone ]

[ TOP ]

Example: Lead

Route 1

Highest hold:

[ − ] Hold [ + ]

[ TOP ]

Attempts:

[ − ] [ + ]

Time:

[ Start ] [ Stop ]

Example: Top-rope

Route 1

Highest hold:

[ − ] Hold [ + ]

[ TOP ]

Attempts:

[ − ] [ + ]

The exact controls should depend on the competition’s configured scoring system.

Use large touch targets.

Avoid unnecessary navigation.

Show the competitor’s current total score prominently.

Make the interface usable with one hand.

Provide visual confirmation after a result is saved.

Optimistically update the interface where safe, but ensure the database remains the source of truth.

Handle temporary loss of internet connection gracefully.

If practical, queue changes locally and synchronize them when the connection returns, but never silently lose a competitor’s result.



16. Result editing

Competitors should be able to correct their own results while the competition is active.

For example:

Increase/decrease attempts.

Toggle zone.

Toggle top.

Change highest hold.

Correct time.

Provide an obvious undo/correction mechanism.

Do not allow logically impossible combinations.

Examples:

A Top should imply reaching the highest required point/hold.

A Zone should not be possible on a boulder without the competitor reaching the zone.

Attempts cannot be negative.

Highest hold cannot exceed the route’s maximum.

Results cannot be modified after the competition has finished.

These rules should be enforced by the application and, where practical, at the database/security level.



17. Export

Create an admin export function.

Export a competition as CSV.

Include:

Competitor number

Competitor name

Category

Discipline

Each route/problem

Performance on each route/problem

Attempts

Zones where applicable

Tops where applicable

Highest hold where applicable

Time where applicable

Points

Total score

Final ranking

Also provide a JSON export containing the complete competition data.

The exported data should be suitable for archiving and later analysis.

The export should contain the underlying performance data as well as calculated results where appropriate.



18. Data lifecycle

Competition data does not need to remain online indefinitely.

Implement:

Archive competition.

Delete competition.

Deleting a competition should delete all related:

Categories

Routes/problems

Competitors

Results

Temporary access credentials

Use appropriate database foreign keys and cascading deletes where safe.

Before permanent deletion, require confirmation from the admin.

The admin should be able to export the competition before deleting it.



19. Security

This is very important.

Use Supabase Row Level Security.

Requirements:

Only authenticated admins can create/edit competitions.

Competitors can only access their own competitor record.

Competitors can only modify their own results.

Competitors cannot modify competition settings.

Competitors cannot modify other competitors.

Public users can only read the minimum data required for the scoreboard.

Finished competitions cannot be modified by competitors.

Access tokens must not be predictable.

Never expose service-role credentials in frontend code.

Validate all important operations server-side/database-side.

Do not trust client-provided competition IDs, competitor IDs, scores, or permissions.

Please create and explain the RLS policies rather than leaving tables unsecured.

Pay particular attention to preventing a competitor from changing a URL, ID, or request parameter to access or modify another competitor’s results.



20. UI design

Use a clean modern sports-event interface.

The application should feel like professional climbing competition software rather than a generic CRUD dashboard.

Priorities:

Very fast.

Mobile-first competitor interface.

Large touch controls.

High contrast.

Clear status indicators.

Minimal unnecessary animations.

Excellent TV scoreboard.

Responsive desktop admin interface.

Use accessible components and keyboard navigation where appropriate.

The competitor interface should adapt naturally to bouldering, lead, and top-rope rather than showing irrelevant controls.



21. Technical architecture

Use:

React

TypeScript

Vite

Tailwind CSS

Supabase

PostgreSQL

Supabase Auth

Supabase Realtime

Structure the code cleanly.

Keep:

Database access

Scoring calculations

Ranking calculations

Authentication

Authorization

UI components

separated.

Use TypeScript types generated from the Supabase schema where possible.

The production frontend must be a static application that can run from GitHub Pages.

Do not introduce a backend server that must be hosted alongside the frontend.

If server-side functionality is required, use Supabase Edge Functions rather than Lovable Cloud or a custom server, and document why the function is necessary.



22. GitHub Pages compatibility

The finished application must be tested and configured for GitHub Pages deployment.

Provide:

Correct Vite base configuration.

GitHub Pages-compatible client-side routing.

Production build configuration.

GitHub Actions workflow for building and deploying the application to GitHub Pages, if appropriate.

Clear deployment instructions in the README.

The application should work at:

https://USERNAME.github.io/REPOSITORY/

rather than assuming it will be hosted at the domain root.

QR-code URLs must also account for the GitHub Pages repository path.

For example, if the application is hosted at:

https://username.github.io/climbing-score/

a competitor QR code should point to the correct application path rather than:

https://username.github.io/competitor/...

Do not make assumptions about the final GitHub username or repository name. Make the base URL configurable.



23. Development approach

Build this as an MVP in logical stages.

First create:

Supabase database schema.

RLS/security policies.

Admin authentication.

Competition management.

Discipline selection.

Category management.

Route/problem management.

Competitor registration.

Temporary competitor authentication.

Generic performance/results model.

Configurable scoring engine.

Ranking calculation.

Competitor scoring UI.

Real-time public scoreboard.

CSV/JSON export.

Archive/delete functionality.

GitHub Pages deployment configuration.

After implementing each major stage, verify that it works before moving to the next stage.

Do not generate fake/mock data as the primary implementation.

Use the real Supabase database.



24. Avoid Lovable Cloud dependencies

This is a mandatory requirement.

The finished application must NOT depend on:

Lovable Cloud hosting.

Lovable Cloud database.

Lovable Cloud authentication.

Lovable Cloud server functions.

Lovable Cloud storage.

Any proprietary Lovable runtime service.

Lovable is being used as a development/code-generation tool, not as the production hosting platform.

The final application must be portable.

A developer should be able to:

Clone the GitHub repository.

Configure the Supabase environment variables.

Run npm install.

Run npm run build.

Deploy the resulting static files to GitHub Pages.

Run the complete application without any Lovable account or Lovable runtime dependency.



25. Important MVP principle

Keep the first version simple.

Do NOT initially implement:

Payments.

Social login for competitors.

Native mobile apps.

Multiple organizations.

Sponsorship management.

Advanced statistics.

Automated competition scheduling.

Complex multi-stage competitions.

Live video.

Hardware integration.

The goal is a reliable application that can run a real climbing competition with approximately 50–300 competitors using their phones.

The most important workflow is:

Admin → Create competition → Select discipline → Configure routes/problems and scoring → Register competitors → QR access → Competitors record results → Live scoreboard → Export results.

The application should be designed so that bouldering, lead, and top-rope are all first-class competition types, while keeping the underlying architecture generic enough to support additional climbing formats later.

Before making significant architectural decisions, prioritize:

Data integrity.

Security.

Real-time reliability.

Ease of use during an actual competition.

Clear separation between underlying performance data and scoring/ranking calculations.

Ability to export all competition data.

Complete independence from Lovable Cloud.

Reliable deployment and operation from GitHub Pages.





Use supabase with github pages frontend, and push directly to: git@github.com:emialk/Send.git

You have access to the repository.



No lovable hosting should be used.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/565efa5d-228a-4c17-bef6-de1c6804b8da).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
