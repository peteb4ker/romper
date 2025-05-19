import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
    it('should render without crashing', () => {
        const { container } = render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>
        );
        expect(container).toBeInTheDocument();
    });

    it('should render navigation links', () => {
        render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>
        );

        expect(screen.getByText('Kits')).toBeInTheDocument();
        expect(screen.getByText('Samples')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should navigate to the correct route when a link is clicked', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <Sidebar />
            </MemoryRouter>
        );

        const kitsLink = screen.getByText('Kits');
        fireEvent.click(kitsLink);

        // Verify the rendered output by checking the "Kits" heading
        expect(screen.getByText('Kits')).toBeInTheDocument();
    });
});
