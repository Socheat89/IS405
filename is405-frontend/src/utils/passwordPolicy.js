// Password Policy & Strength Checker Utility

export const checkPasswordStrength = (password = '') => {
  const criteria = [
    { id: 'length', label: 'At least 8 characters (យ៉ាងតិច ៨ តួ)', met: password.length >= 8 },
    { id: 'upper', label: 'At least 1 uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { id: 'lower', label: 'At least 1 lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { id: 'digit', label: 'At least 1 numeric digit (0-9)', met: /[0-9]/.test(password) },
    { id: 'special', label: 'At least 1 special symbol (!@#$%^&*)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) }
  ];

  const metCount = criteria.filter(c => c.met).length;
  const isStrong = metCount === criteria.length;

  let strengthLabel = 'Very Weak';
  let strengthColor = 'rose';
  let percentage = (metCount / criteria.length) * 100;

  if (metCount >= 5) {
    strengthLabel = 'Strong (ខ្លាំង)';
    strengthColor = 'emerald';
  } else if (metCount >= 3) {
    strengthLabel = 'Moderate (មធ្យម)';
    strengthColor = 'amber';
  } else if (metCount >= 1) {
    strengthLabel = 'Weak (ខ្សោយ)';
    strengthColor = 'rose';
  }

  return {
    criteria,
    metCount,
    isStrong,
    strengthLabel,
    strengthColor,
    percentage
  };
};
