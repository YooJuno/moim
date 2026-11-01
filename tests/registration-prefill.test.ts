import {describe,expect,it} from 'vitest';
import {missingRegistrationFields,registrationPrefill} from '../shared/registration-fields';

describe('social registration suggestions',()=>{
  it('normalizes a supplied Korean phone and month/day without guessing absent details',()=>{
    expect(registrationPrefill('+82 10-1234-5678','0229')).toEqual({phone:'010-1234-5678',birthday:'02-29'});
    expect(registrationPrefill('0082 10 1234 5678','02-20')).toEqual({phone:'010-1234-5678',birthday:'02-20'});
    expect(registrationPrefill(null,undefined)).toEqual({});
    expect(registrationPrefill('not-a-phone','0230')).toEqual({});
    expect(registrationPrefill('010-1234-5678','2026-02-20')).toEqual({phone:'010-1234-5678'});
  });
  it('fills missing fields while preserving saved details and preferences',()=>{
    const current={phone:'010-9999-9999',birthday:'03-04',area:'서울 중랑구',theme:'dark'};
    const provided={phone:'010-1234-5678',birthday:'02-20'};
    expect(missingRegistrationFields(current,provided)).toEqual({});
    expect(current).toEqual({phone:'010-9999-9999',birthday:'03-04',area:'서울 중랑구',theme:'dark'});
    expect(missingRegistrationFields({phone:'',area:''},provided)).toEqual(provided);
    expect(missingRegistrationFields({phone:'',area:'서울 중랑구'},provided)).toEqual({});
    expect(missingRegistrationFields({phone:'010-9999-9999',birthday:''},provided)).toEqual({birthday:'02-20'});
  });
});
