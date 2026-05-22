import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const COUNTRIES = [
  'United Kingdom',
  'Ireland',
  'United States',
  'Australia',
  'Canada',
  'New Zealand',
  'South Africa',
  'India',
  'Pakistan',
  'Nigeria',
  'Ghana',
  'Kenya',
  'Zimbabwe',
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'Indonesia',
  'Iran',
  'Iraq',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'Nicaragua',
  'Niger',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Other',
];

const OnboardingFlow = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Extract first name from signup metadata
  const fullName = user?.user_metadata?.full_name ?? '';
  const firstName = fullName.split(' ')[0] ?? '';

  const [form, setForm] = useState({
    exam_status: '',
    maths_tier: '',
    physics_tier: '',
    country: '',
    parent_name: '',
    parent_email: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isValid =
    form.exam_status &&
    form.maths_tier &&
    form.physics_tier &&
    form.country &&
    form.parent_name.trim() &&
    form.parent_email.trim();

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        student_first_name: firstName,
        country: form.country,
        parent_email: form.parent_email.trim(),
        parent_name: form.parent_name.trim(),
        maths_tier: form.maths_tier,
        physics_tier: form.physics_tier,
        onboarding_complete: true,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast({
        title: 'Something went wrong',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: `Welcome to The Hub Jam, ${firstName}!`,
      description: "Your account is all set. Let's get started.",
    });

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f9f3eb] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div
            className="inline-block text-white text-sm font-bold px-4 py-1.5 rounded-full mb-4"
            style={{
              background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
            }}
          >
            The Practice Hub
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {firstName ? `Hi ${firstName} — let's set up your account` : "Let's set up your account"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Takes about a minute — just a few details to get started.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-7">

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              When are you sitting your exams?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'this_year', label: 'This year' },
                { value: 'next_year', label: 'Next year' },
                { value: 'later', label: 'At a later date' },
                { value: 'not_sitting', label: "I'm not sitting exams" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set('exam_status', opt.value)}
                  className={`h-11 rounded-lg border text-sm font-medium transition-all ${
                    form.exam_status === opt.value
                      ? 'border-[#E23D28] bg-[#E23D28]/5 text-[#E23D28]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Which Maths tier are you studying?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'Foundation', label: 'Foundation' },
                { value: 'Higher', label: 'Higher' },
                { value: 'not_gcse', label: 'Not doing GCSE Maths' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set('maths_tier', opt.value)}
                  className={`h-11 rounded-lg border text-sm font-medium transition-all ${
                    form.maths_tier === opt.value
                      ? 'border-[#E23D28] bg-[#E23D28]/5 text-[#E23D28]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Which Physics tier are you studying?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'Foundation', label: 'Foundation' },
                { value: 'Higher', label: 'Higher' },
                { value: 'not_gcse', label: 'Not doing GCSE Physics' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set('physics_tier', opt.value)}
                  className={`h-11 rounded-lg border text-sm font-medium transition-all ${
                    form.physics_tier === opt.value
                      ? 'border-[#E23D28] bg-[#E23D28]/5 text-[#E23D28]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Country
            </label>
            <select
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E23D28]/30 transition-shadow"
            >
              <option value="">Select your country…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-100 pt-1">
            <p className="text-xs text-gray-400 mb-5">
              Parent or guardian details — we'll only contact them for account
              or safeguarding matters.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Parent / Guardian name
              </label>
              <input
                type=