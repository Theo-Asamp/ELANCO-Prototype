# GrazeSafe  
### Pasture & Parasite Risk Mapping Prototype

GrazeSafe is a client-driven, web-based proof-of-technology developed as part of the  
**Professional Software Projects** module at Sheffield Hallam University.

The project explores how simple geospatial visualisation and public environmental data
can be combined to highlight **potential parasite risk indicators** for grazing livestock
across the UK.

> ⚠️ This is a prototype designed to support discussion and understanding.  
> It does **not** provide clinical diagnosis or predictive modelling.

---

## Project Goals

- Visualise pasture or farm locations on an interactive UK map
- Integrate simple external environmental data (e.g. weather)
- Apply a transparent, rule-based parasite risk indicator
- Present results clearly to **non-technical users**
- Support discussion rather than automated decision-making

---

## Target Users

- Farmers  
- Veterinarians  
- Agricultural advisors  
- Internal Elanco teams (engineering, data, product)

Users are assumed to be non-technical and value clarity and explainability.

---

## Technology Stack

### Frontend
- HTML, CSS, JavaScript
- Leaflet.js (interactive mapping)*
- OpenStreetMap tiles*
- GeoJSON for pasture/farm data*

### Backend / Data
- Lightweight Node.js or serverless functions
- Public weather API (e.g. rainfall and temperature)
- Simple rule-based risk logic (Low / Medium / High)

### Tooling & Deployment
- GitHub (version control)
- Netlify / GitHub Pages (deployment)*



