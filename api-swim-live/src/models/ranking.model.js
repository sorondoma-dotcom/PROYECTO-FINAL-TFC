class RankingEntry {
  constructor({
    position,
    overallRank,
    athlete,
    name,
    country,
    time,
    points,
    age,
    reactionTime,
    timeBehind,
    competition,
    location,
    date,
    imageUrl,
    profileUrl,
    hasPhoto,
    extra = {},
    splits = [],
    rowIndex
  }) {
    this.position = position ?? overallRank ?? null;
    this.overallRank = overallRank ?? position ?? null;
    this.athlete = athlete || name || '';
    this.name = name || athlete || '';
    this.country = country || '';
    this.time = time || '';
    this.points = points || '';
    this.age = age || '';
    this.reactionTime = reactionTime || '';
    this.timeBehind = timeBehind || '';
    this.competition = competition || '';
    this.location = location || '';
    this.date = date || '';
    this.imageUrl = imageUrl || '';
    this.profileUrl = profileUrl || '';
    this.hasPhoto = Boolean(hasPhoto);
    this.rowIndex = rowIndex ?? null;
    this.extra = extra;
    this.splits = splits;
  }

  static fromRaw(raw = {}) {
    return new RankingEntry(raw);
  }

  toJSON() {
    return {
      position: this.position,
      overallRank: this.overallRank,
      athlete: this.athlete,
      name: this.name,
      country: this.country,
      time: this.time,
      points: this.points,
      age: this.age,
      reactionTime: this.reactionTime,
      timeBehind: this.timeBehind,
      competition: this.competition,
      location: this.location,
      date: this.date,
      imageUrl: this.imageUrl,
      profileUrl: this.profileUrl,
      hasPhoto: this.hasPhoto,
      rowIndex: this.rowIndex,
      extra: this.extra,
      splits: this.splits
    };
  }
}

module.exports = { RankingEntry };
