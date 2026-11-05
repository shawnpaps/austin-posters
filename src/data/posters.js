const posterNames = [
	"Sixth Street After Dark",
	"Barton Springs",
	"Cosmic Cowboy",
	"South Congress",
	"Capitol in Color",
	"Live Music Capital",
	"Deep Eddy",
	"Greetings from Austin",
	"Violet Crown",
	"East Side Heat",
	"Lady Bird Lake",
	"Texas Forever",
	"Continental Club",
	"Zilker Sunday",
	"Red River Rhythm",
	"Bluebonnet Season",
	"Mount Bonnell",
	"Keep Austin",
	"Lone Star Nights",
	"Congress Avenue",
	"Greenbelt",
	"Neon Cactus",
	"Moontower",
	"Hill Country Drive",
	"Broken Spoke",
	"Bat City",
	"Sunset on Lamar",
	"Honky Tonk",
	"Waterloo Records",
	"Summer at the Springs",
	"Austin City Limits",
	"I-35 South",
];

const posterFormats = ["portrait", "tall", "square", "portrait", "wide"];

const posterPalettes = [
	["#f84616", "#f1f1f1", "#000000"],
	["#edcb52", "#18392b", "#f1f1f1"],
	["#4475b7", "#f2c9ca", "#111111"],
	["#db4a36", "#f0dfbd", "#2c4b3f"],
	["#111111", "#d9360d", "#ffffff"],
	["#e8a6bd", "#2d5590", "#f5e7c7"],
];

export const posters = posterNames.map((title, index) => ({
	id: `poster-${index + 1}`,
	title,
	year: 1968 + ((index * 3) % 55),
	format: posterFormats[index % posterFormats.length],
	colors: posterPalettes[index % posterPalettes.length],
}));
