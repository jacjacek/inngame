import { ImageSourcePropType } from 'react-native';

export const trainerPhotos: Record<string, ImageSourcePropType> = {
  'bartek-nowak': require('../assets/mymovio/trainers/bartek-nowak.png'),
  'anna-kowalska': require('../assets/mymovio/trainers/anna-kowalska.png'),
  'michal-zielinski': require('../assets/mymovio/trainers/michal-zielinski.png'),
};

export const conversationPhotos: Record<string, ImageSourcePropType> = {
  bartek: trainerPhotos['bartek-nowak'],
  anna: trainerPhotos['anna-kowalska'],
};
