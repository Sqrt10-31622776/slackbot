import {firestore} from 'firebase-admin';
import {initializeApp} from 'firebase-admin/app';
import {firestore as functions_firestore} from 'firebase-functions';

initializeApp();
const db = firestore();

export const updateCounts = functions_firestore.document('achievements/{id}').onCreate((achievement) => {
	db.runTransaction(async (transaction) => {
		const name = achievement.get('name');
		const user = achievement.get('user');
		const date = new Date(achievement.get('date').seconds * 1000);
		const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

		const achievementRef = db.collection('achievement_data').doc(name);
		const achievementDatum = await transaction.get(achievementRef);

		const category = achievementDatum.get('category');
		const difficulty = achievementDatum.get('difficulty');

		const userRef = db.collection('users').doc(user);
		const categoryStatRef = db.collection('achievement_stats_by_category').doc(category);
		const difficultyStatRef = db.collection('achievement_stats_by_difficulty').doc(difficulty);
		const monthStatRef = db.collection('achievement_stats_by_month').doc(month);

		const userDatum = await transaction.get(userRef);
		const categoryStatDatum = await transaction.get(categoryStatRef);
		const difficultyStatDatum = await transaction.get(difficultyStatRef);
		const monthStatDatum = await transaction.get(monthStatRef);

		transaction.update(achievementRef, {
			count: (achievementDatum.get('count') || 0) + 1,
			...(achievementDatum.get('first') === undefined ? {first: user} : {}),
		});

		transaction.set(categoryStatRef, {count: (categoryStatDatum.get('count') || 0) + 1});
		transaction.set(difficultyStatRef, {count: (difficultyStatDatum.get('count') || 0) + 1});
		transaction.set(monthStatRef, {count: (monthStatDatum.get('count') || 0) + 1});

		const oldCounts = userDatum.get('counts') || {};
		transaction.update(userRef, {
			counts: {
				...oldCounts,
				[category]: (oldCounts[category] || 0) + 1,
			},
		});
	});
});
