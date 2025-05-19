import React from 'react';
import { render } from '@testing-library/react';
import SamplesView from './SamplesView';

describe('SamplesView', () => {
    it('should render without crashing', () => {
        const { container } = render(<SamplesView />);
        expect(container).toBeInTheDocument();
    });
});
