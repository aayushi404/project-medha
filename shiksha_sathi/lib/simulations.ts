/**
 * Curated catalogue of PhET Interactive Simulations (University of Colorado
 * Boulder). Frontend-only registry -- same idea as `lib/tools.ts`. No backend:
 * PhET HTML5 sims are embedded straight from phet.colorado.edu via an <iframe>,
 * and the thumbnail is a plain <img> off the same host.
 *
 * PhET HTML5 sims are licensed CC BY 4.0 and free for educational,
 * non-commercial use *with attribution* -- the attribution line is rendered on
 * the browser and player screens (see components/simulations/).
 *
 * Adding a sim: find its id on https://phet.colorado.edu/en/simulations/browse
 * (the id is the last path segment of the sim URL), confirm
 * https://phet.colorado.edu/sims/html/<id>/latest/<id>_en.html loads, then
 * append an entry below. `slug` is our URL segment; keeping it equal to the
 * PhET id keeps things simple.
 */

export type SimSubject = "physics" | "chemistry" | "biology" | "earth" | "math";

export const SIM_SUBJECTS: { key: SimSubject; label: string }[] = [
  { key: "physics", label: "Physics" },
  { key: "chemistry", label: "Chemistry" },
  { key: "biology", label: "Biology" },
  { key: "earth", label: "Earth & Space" },
  { key: "math", label: "Math" },
];

export type Simulation = {
  /** our URL segment -- kept identical to `phetId` */
  slug: string;
  /** PhET sim id, used to build the iframe + thumbnail URLs */
  phetId: string;
  title: string;
  subject: SimSubject;
  /** inclusive class band, e.g. [6, 10] */
  grades: [number, number];
  /** one-line description, shown on the card and the player */
  blurb: string;
};

const PHET_HOST = "https://phet.colorado.edu/sims/html";

/** The embeddable HTML5 sim (PhET's own embed code points here). */
export const phetSimUrl = (phetId: string) =>
  `${PHET_HOST}/${phetId}/latest/${phetId}_en.html`;

/** 600px preview image bundled with every published sim. */
export const phetThumbUrl = (phetId: string) =>
  `${PHET_HOST}/${phetId}/latest/${phetId}-600.png`;

/** The sim's page on phet.colorado.edu (for the "Open on PhET" link). */
export const phetPageUrl = (phetId: string) =>
  `https://phet.colorado.edu/en/simulations/${phetId}`;

/** Attribution required by the CC BY 4.0 licence. */
export const PHET_ATTRIBUTION = {
  text: "Simulations by PhET Interactive Simulations, University of Colorado Boulder, licensed under CC BY 4.0.",
  href: "https://phet.colorado.edu",
  licenseHref: "https://creativecommons.org/licenses/by/4.0/",
};

const sim = (
  phetId: string,
  title: string,
  subject: SimSubject,
  grades: [number, number],
  blurb: string,
): Simulation => ({ slug: phetId, phetId, title, subject, grades, blurb });

// Every id below was checked against phet.colorado.edu and loads.
export const SIMULATIONS: Simulation[] = [
  // -- physics ---------------------------------------------------------------
  sim("forces-and-motion-basics", "Forces and Motion: Basics", "physics", [6, 10],
    "Push objects around and see how net force, friction and mass change motion."),
  sim("projectile-motion", "Projectile Motion", "physics", [8, 12],
    "Fire a projectile and explore how angle, speed, mass and air resistance shape its path."),
  sim("energy-skate-park-basics", "Energy Skate Park: Basics", "physics", [6, 10],
    "Watch kinetic and potential energy trade off as a skater rolls the track."),
  sim("energy-skate-park", "Energy Skate Park", "physics", [9, 12],
    "Build tracks and measure energy, work and friction with graphs and a pie chart."),
  sim("pendulum-lab", "Pendulum Lab", "physics", [8, 12],
    "Change length, gravity and mass to investigate what sets a pendulum's period."),
  sim("masses-and-springs", "Masses and Springs", "physics", [8, 12],
    "Hang masses on springs to study Hooke's law, oscillation and energy."),
  sim("hookes-law", "Hooke's Law", "physics", [9, 12],
    "Stretch and compress springs to relate force, displacement and spring constant."),
  sim("friction", "Friction", "physics", [6, 10],
    "Rub two surfaces together and see friction turn motion into heat, atom by atom."),
  sim("wave-on-a-string", "Wave on a String", "physics", [8, 12],
    "Wiggle a string to explore amplitude, frequency, wave speed and reflection."),
  sim("waves-intro", "Waves Intro", "physics", [7, 12],
    "Make water, sound and light waves and compare wavelength, frequency and speed."),
  sim("sound-waves", "Sound Waves", "physics", [8, 12],
    "See how a speaker compresses air and how pressure waves carry sound."),
  sim("bending-light", "Bending Light", "physics", [9, 12],
    "Shine a beam between media to study refraction, reflection and total internal reflection."),
  sim("geometric-optics", "Geometric Optics", "physics", [9, 12],
    "Place objects near lenses and mirrors and trace rays to locate the image."),
  sim("color-vision", "Color Vision", "physics", [5, 9],
    "Mix coloured light and filters to see how the eye perceives colour."),
  sim("gravity-force-lab", "Gravity Force Lab", "physics", [9, 12],
    "Adjust two masses and their separation to feel Newton's law of gravitation."),
  sim("balancing-act", "Balancing Act", "physics", [5, 10],
    "Place masses on a plank and predict which way the seesaw tips using torque."),
  sim("density", "Density", "physics", [6, 10],
    "Measure mass and volume of blocks to work out why things float or sink."),
  sim("buoyancy", "Buoyancy", "physics", [9, 12],
    "Submerge objects and read the buoyant force, displaced fluid and pressure."),
  sim("under-pressure", "Under Pressure", "physics", [8, 12],
    "Explore how fluid pressure changes with depth, density and gravity."),
  sim("circuit-construction-kit-dc", "Circuit Construction Kit: DC", "physics", [7, 12],
    "Build circuits with batteries, bulbs, resistors and switches; read current and voltage."),
  sim("ohms-law", "Ohm's Law", "physics", [8, 12],
    "See how current depends on voltage and resistance as you turn the dials."),
  sim("resistance-in-a-wire", "Resistance in a Wire", "physics", [9, 12],
    "Change a wire's length, area and resistivity and watch its resistance respond."),
  sim("generator", "Generator", "physics", [8, 12],
    "Turn a magnet past a coil with a water wheel to induce an electric current."),
  sim("faradays-law", "Faraday's Law", "physics", [9, 12],
    "Move a bar magnet through a coil to explore electromagnetic induction."),
  sim("faradays-electromagnetic-lab", "Faraday's Electromagnetic Lab", "physics", [9, 12],
    "Bar magnets, pickup coils, electromagnets and a transformer in one lab."),
  sim("magnets-and-electromagnets", "Magnets and Electromagnets", "physics", [6, 10],
    "Compare a bar magnet with an electromagnet and map their fields with a compass."),
  sim("magnet-and-compass", "Magnet and Compass", "physics", [5, 9],
    "See how a compass needle follows a bar magnet's field, like Earth's own field."),
  sim("balloons-and-static-electricity", "Balloons and Static Electricity", "physics", [5, 10],
    "Rub a balloon on a sweater to explore charge transfer and attraction."),
  sim("john-travoltage", "John Travoltage", "physics", [5, 9],
    "Build up static charge on a foot and discharge a spark from a fingertip."),

  // -- chemistry -----------------------------------------------------------
  sim("build-an-atom", "Build an Atom", "chemistry", [6, 12],
    "Add protons, neutrons and electrons to build atoms and ions and read the symbol."),
  sim("build-a-molecule", "Build a Molecule", "chemistry", [7, 12],
    "Snap atoms together to make real molecules and collect them."),
  sim("isotopes-and-atomic-mass", "Isotopes and Atomic Mass", "chemistry", [9, 12],
    "Mix isotopes of an element to see how abundance sets the average atomic mass."),
  sim("states-of-matter-basics", "States of Matter: Basics", "chemistry", [6, 10],
    "Heat and cool substances to watch solids, liquids and gases switch."),
  sim("states-of-matter", "States of Matter", "chemistry", [9, 12],
    "Control temperature and pressure and study phase changes and interaction potentials."),
  sim("ph-scale", "pH Scale", "chemistry", [8, 12],
    "Test everyday liquids, dilute them and see hydronium and hydroxide counts."),
  sim("ph-scale-basics", "pH Scale: Basics", "chemistry", [6, 10],
    "Compare the pH of common liquids and see what acids and bases mean."),
  sim("acid-base-solutions", "Acid-Base Solutions", "chemistry", [9, 12],
    "Compare strong and weak acids and bases by conductivity, pH and equilibrium."),
  sim("concentration", "Concentration", "chemistry", [8, 12],
    "Add solute, water and evaporate to change molarity and watch saturation."),
  sim("molarity", "Molarity", "chemistry", [9, 12],
    "Vary moles of solute and solution volume to see how concentration changes."),
  sim("beers-law-lab", "Beer's Law Lab", "chemistry", [10, 12],
    "Shine light through solutions to relate absorbance to concentration and path length."),
  sim("balancing-chemical-equations", "Balancing Chemical Equations", "chemistry", [8, 12],
    "Adjust coefficients until atoms balance, checked with a scale and bar chart."),
  sim("reactants-products-and-leftovers", "Reactants, Products and Leftovers", "chemistry", [7, 12],
    "Run reactions like making sandwiches to see limiting reactants and leftovers."),
  sim("gas-properties", "Gas Properties", "chemistry", [9, 12],
    "Pump gas into a box and change volume, temperature and heat to test the gas laws."),
  sim("gases-intro", "Gases Intro", "chemistry", [7, 11],
    "A gentler start on gases: pump particles in and watch pressure and temperature."),
  sim("diffusion", "Diffusion", "chemistry", [7, 11],
    "Open a barrier between two gases and watch particles mix by random motion."),

  // -- biology -----------------------------------------------------------
  sim("natural-selection", "Natural Selection", "biology", [8, 12],
    "Add mutations and selection pressures to a rabbit population and watch it evolve."),
  sim("gene-expression-essentials", "Gene Expression Essentials", "biology", [9, 12],
    "Switch genes on and off and build proteins through transcription and translation."),
  sim("neuron", "Neuron", "biology", [9, 12],
    "Stimulate a neuron and watch ions cross the membrane to fire an action potential."),

  // -- earth & space ---------------------------------------------------------
  sim("greenhouse-effect", "The Greenhouse Effect", "earth", [7, 12],
    "Add greenhouse gases and clouds and watch infrared photons warm the surface."),
  sim("gravity-and-orbits", "Gravity and Orbits", "earth", [7, 12],
    "Turn gravity on and off for the Sun, Earth and Moon and see the orbits respond."),
  sim("my-solar-system", "My Solar System", "earth", [9, 12],
    "Set masses, positions and velocities and watch the gravitational dance unfold."),

  // -- math ------------------------------------------------------------------
  sim("fractions-intro", "Fractions: Intro", "math", [3, 7],
    "Build fractions from shapes and number lines and match them to a picture."),
  sim("fractions-equality", "Fractions: Equality", "math", [4, 8],
    "Find equivalent fractions with shapes, number lines and a balance."),
  sim("build-a-fraction", "Build a Fraction", "math", [3, 7],
    "Make target fractions from pieces to earn stars across levels."),
  sim("fraction-matcher", "Fraction Matcher", "math", [3, 8],
    "Match fractions to shapes and to each other in a timed game."),
  sim("fractions-mixed-numbers", "Fractions: Mixed Numbers", "math", [4, 8],
    "Convert between mixed numbers and improper fractions with visual pieces."),
  sim("area-model-multiplication", "Area Model Multiplication", "math", [4, 8],
    "Split a rectangle into partial products to see how multiplication works."),
  sim("arithmetic", "Arithmetic", "math", [2, 6],
    "Practise multiplication, factoring and division on an interactive times table."),
  sim("number-line-integers", "Number Line: Integers", "math", [5, 9],
    "Add and subtract integers by hopping along a number line."),
  sim("graphing-lines", "Graphing Lines", "math", [7, 11],
    "Change slope and intercept in different forms and watch the line move."),
  sim("graphing-slope-intercept", "Graphing Slope-Intercept", "math", [7, 10],
    "Focus on y = mx + b: drag the line or set slope and intercept directly."),
  sim("unit-rates", "Unit Rates", "math", [6, 9],
    "Shop for produce and fuel to build up unit rates and proportional reasoning."),
  sim("proportion-playground", "Proportion Playground", "math", [6, 10],
    "Mix paint, build necklaces and stretch springs to explore ratio and proportion."),
  sim("trig-tour", "Trig Tour", "math", [9, 12],
    "Walk the unit circle and see sine, cosine and tangent trace out their graphs."),
  sim("function-builder", "Function Builder", "math", [5, 10],
    "Chain machines that halve, double and add, then read the input-output table."),
  sim("plinko-probability", "Plinko Probability", "math", [7, 12],
    "Drop balls through pegs and watch a histogram approach the binomial distribution."),
  sim("curve-fitting", "Curve Fitting", "math", [9, 12],
    "Place data points and fit polynomials, reading r-squared and residuals."),
  sim("least-squares-regression", "Least-Squares Regression", "math", [10, 12],
    "Add points and compare your best-fit line with the least-squares line."),
];

export const getSimulation = (slug: string): Simulation | null =>
  SIMULATIONS.find((s) => s.slug === slug) ?? null;
