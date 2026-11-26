// Kingdom Christmas: the private question set for the Kingdom Story Company Christmas party (Dec 16, 2026).
// Only sent to the big-screen page after the passcode (see worker.js). DRAFT: Brandon approves every question.
//
// Each question: { q, right, wrong: [3 wrong answers], fact } (the big screen shuffles the choices),
// optional img: 'data:image/jpeg;base64,…' for picture questions (shown on the TV only).
// Each category needs at least `questionsPerRound` questions. The Final Round is double points.

export default {
  title: 'Kingdom Christmas',
  questionsPerRound: 4,
  categories: [
    {
      id: 'inside',
      name: 'Inside Kingdom',
      blurb: 'How well do you know us?',
      questions: [
        { q: 'Which of these companies is NOT associated with Tony Young?', right: 'Diversified Automotive', wrong: ['3CR', 'City on a Hill', 'Aegis'], fact: '' },
        { q: 'Which of these movies did Daryl NOT work on?', right: 'Flags of Our Fathers', wrong: ['X-Men', 'The Polar Express', 'Nancy Drew'], fact: '' },
        { q: 'Which of these dates did NOT have a Kingdom film release?', right: 'December 17, 2021', wrong: ['November 8, 2024', 'February 24, 2023', 'October 4, 2024'], fact: 'American Underdog opened a week later, on Christmas Day 2021.' },
        { q: 'What is Hamilton Walsh\'s middle name?', right: 'Joshua', wrong: ['Michael', 'Tyler', 'Robert'], fact: '' },
        { q: 'How many siblings does Brandon have?', right: '4', wrong: ['5', '3', '2'], fact: '' },
        { q: 'What is the name of the parenting book written by Sheila Erwin?', right: 'Raising Up Dreamers', wrong: ['Wonders of Parenting', 'The Adventures of Jon & Andy', 'Imagine the Future'], fact: '' },
        { q: 'What tattoo does Josh have on his arm?', right: 'A shamrock', wrong: ['The Erwin Brothers logo', 'A cross', 'The for KING + COUNTRY logo'], fact: '' },
        { q: 'Who is the oldest Bailey brother?', right: 'Justin', wrong: ['Josh', 'Ben', 'Tyler'], fact: '' },
        { q: 'Ben Howard ran which faith film company?', right: 'Provident', wrong: ['Affirm', 'Pure Flix', 'Kingdom+'], fact: '' },
        { q: 'Which school did Nick graduate from?', right: 'Harvard', wrong: ['Yale', 'USC', 'Princeton'], fact: '' },
      ],
    },
    {
      id: 'kingdom-films',
      name: 'Kingdom on Screen',
      blurb: 'Our movies, our stories',
      questions: [
        { q: 'Which band\'s lead singer is the real-life story behind I Can Only Imagine?', right: 'MercyMe', wrong: ['Casting Crowns', 'Third Day', 'for KING & COUNTRY'], fact: 'Bart Millard wrote the song about his father.' },
        { q: 'In I Still Believe, KJ Apa plays which singer?', right: 'Jeremy Camp', wrong: ['Chris Tomlin', 'TobyMac', 'Phil Wickham'], fact: 'Released March 13, 2020.' },
        { q: 'American Underdog tells the story of which NFL quarterback?', right: 'Kurt Warner', wrong: ['Tim Tebow', 'Drew Brees', 'Kurt Cousins'], fact: 'Zachary Levi played Warner; it opened Christmas Day 2021.' },
        { q: 'In Jesus Revolution, who plays Pastor Chuck Smith?', right: 'Kelsey Grammer', wrong: ['Dennis Quaid', 'Jon Voight', 'John Goodman'], fact: 'Jonathan Roumie played Lonnie Frisbee.' },
        { q: 'Unsung Hero is the story of the family behind which band?', right: 'for KING & COUNTRY', wrong: ['Newsboys', 'MercyMe', 'Casting Crowns'], fact: 'Joel Smallbone co-directed and plays his own dad.' },
        { q: 'Which two-time Oscar winner stars in Ordinary Angels?', right: 'Hilary Swank', wrong: ['Sandra Bullock', 'Jodie Foster', 'Julia Roberts'], fact: 'Alan Ritchson co-stars.' },
        { q: 'I Can Only Imagine 2 stars which actor as singer Tim Timmons?', right: 'Milo Ventimiglia', wrong: ['Zachary Levi', 'Chris Pratt', 'Scott Eastwood'], fact: 'Directed by Andrew Erwin and Brent McCorkle.' },
        { q: 'Which studio is Kingdom\'s longtime partner on its films?', right: 'Lionsgate', wrong: ['Sony Pictures', 'Paramount', 'Universal'], fact: 'Their first-look deal has been renewed three times.' },
      ],
    },
    {
      id: 'pageant',
      name: 'The Best Christmas Pageant Ever',
      blurb: 'The Herdmans are coming',
      questions: [
        { q: 'What is the name of the troublemaking family in The Best Christmas Pageant Ever?', right: 'The Herdmans', wrong: ['The Griswolds', 'The Bumpuses', 'The McCallisters'], fact: 'Six Herdman kids, and every one of them is trouble.' },
        { q: 'Who directed The Best Christmas Pageant Ever (2024)?', right: 'Dallas Jenkins', wrong: ['Jon Gunn', 'Andrew Erwin', 'Brent McCorkle'], fact: 'Jenkins also created The Chosen.' },
        { q: 'Which Herdman kid volunteers to play Mary?', right: 'Imogene', wrong: ['Gladys', 'Ralph', 'Ollie'], fact: 'Played by Beatrice Schneider.' },
        { q: 'Who plays Grace Bradley, the mom who ends up running the pageant?', right: 'Judy Greer', wrong: ['Lauren Graham', 'Kristen Bell', 'Jennifer Garner'], fact: 'Lauren Graham narrates as grown-up Beth.' },
        { q: 'The movie is based on a 1972 book by which author?', right: 'Barbara Robinson', wrong: ['Beverly Cleary', 'Judy Blume', 'Madeleine L\'Engle'], fact: 'The book has sold millions of copies.' },
        { q: 'What first brings the Herdmans to church?', right: 'They hear there are free treats', wrong: ['A court order', 'Their mom makes them go', 'A lost dog'], fact: 'Charlie brags about the snacks at Sunday school.' },
      ],
    },
    {
      id: 'classics',
      name: 'Christmas Movie Classics',
      blurb: 'The ones we watch every year',
      questions: [
        { q: 'In Home Alone, where are the McCallisters flying when they leave Kevin behind?', right: 'Paris', wrong: ['London', 'Rome', 'Orlando'], fact: 'Kevin holds off the Wet Bandits, Harry and Marv.' },
        { q: 'In Elf, what does Buddy put on his spaghetti?', right: 'Maple syrup', wrong: ['Chocolate sauce', 'Whipped cream', 'Gumdrops'], fact: 'Elves stick to the four main food groups: candy, candy canes, candy corns and syrup.' },
        { q: 'What does Ralphie want for Christmas in A Christmas Story?', right: 'A Red Ryder BB gun', wrong: ['A leg lamp', 'A sled', 'A decoder ring'], fact: '"You\'ll shoot your eye out!"' },
        { q: 'In It\'s a Wonderful Life, what does Clarence earn at the end?', right: 'His wings', wrong: ['A halo', 'A harp', 'A medal'], fact: '"Every time a bell rings, an angel gets his wings."' },
        { q: 'In How the Grinch Stole Christmas, how many sizes does the Grinch\'s heart grow?', right: 'Three', wrong: ['Two', 'Five', 'Ten'], fact: 'His dog Max was along for the ride.' },
        { q: 'In The Polar Express, what is the first gift of Christmas?', right: 'A sleigh bell', wrong: ['A golden ticket', 'A snow globe', 'A toy train'], fact: 'Only believers can hear it ring.' },
        { q: 'Which actor plays Clark Griswold in Christmas Vacation?', right: 'Chevy Chase', wrong: ['Steve Martin', 'Bill Murray', 'John Candy'], fact: 'Clark hangs 25,000 imported Italian twinkle lights.' },
        { q: 'In Rudolph the Red-Nosed Reindeer (1964), what does Hermey the elf want to be?', right: 'A dentist', wrong: ['A pilot', 'A baker', 'A doctor'], fact: 'They end up on the Island of Misfit Toys.' },
      ],
    },
    {
      id: 'carols',
      name: 'Carols & the Christmas Story',
      blurb: 'Hark! Trivia!',
      questions: [
        { q: 'In which gospel does Linus read the Christmas story in A Charlie Brown Christmas?', right: 'Luke', wrong: ['Matthew', 'Mark', 'John'], fact: 'Luke 2:8–14, "Fear not."' },
        { q: '"Silent Night" was first written in which language?', right: 'German', wrong: ['Latin', 'English', 'French'], fact: '"Stille Nacht," first sung in Austria in 1818.' },
        { q: 'Which gift did the wise men NOT bring?', right: 'Silver', wrong: ['Gold', 'Frankincense', 'Myrrh'], fact: 'Matthew 2:11.' },
        { q: 'In "The Twelve Days of Christmas," what are there twelve of?', right: 'Drummers drumming', wrong: ['Lords a-leaping', 'Pipers piping', 'Maids a-milking'], fact: 'Ten lords, eleven pipers, twelve drummers.' },
        { q: 'Which of these is NOT one of Santa\'s reindeer in the classic poem?', right: 'Rudolph', wrong: ['Blitzen', 'Comet', 'Vixen'], fact: 'Rudolph came along in 1939.' },
        { q: 'In which town was Jesus born?', right: 'Bethlehem', wrong: ['Nazareth', 'Jerusalem', 'Galilee'], fact: 'Micah 5:2 named the town centuries earlier.' },
      ],
    },
  ],
  final: {
    name: 'Final Round',
    questions: [
      { q: 'I Can Only Imagine (2018) was made for about $7 million. About how much did it earn in the U.S.?', right: '$83 million', wrong: ['$25 million', '$41 million', '$150 million'], fact: 'Its success helped launch Kingdom.' },
      { q: 'Where was The Best Christmas Pageant Ever filmed?', right: 'Winnipeg, Canada', wrong: ['Franklin, Tennessee', 'Vancouver, Canada', 'Atlanta, Georgia'], fact: 'Shot in the winter of 2023–24.' },
      { q: 'Who plays Lonnie Frisbee in Jesus Revolution?', right: 'Jonathan Roumie', wrong: ['Joel Courtney', 'KJ Apa', 'Joel Smallbone'], fact: 'Roumie is best known as Jesus in The Chosen.' },
      { q: 'Which actor plays coach Dick Vermeil in American Underdog?', right: 'Dennis Quaid', wrong: ['Kevin Costner', 'Gary Cole', 'Jon Voight'], fact: 'Anna Paquin plays Brenda Warner.' },
      { q: 'In Miracle on 34th Street, which store hires Kris Kringle?', right: 'Macy\'s', wrong: ['Gimbels', 'Bloomingdale\'s', 'Sears'], fact: 'He sends shoppers to rival Gimbels.' },
      { q: 'What year did Kingdom Story Company launch?', right: '2019', wrong: ['2016', '2018', '2021'], fact: 'Announced at the NRB convention in Anaheim.' },
    ],
  },
};
